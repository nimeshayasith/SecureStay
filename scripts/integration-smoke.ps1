$ErrorActionPreference = "Stop"

function Get-DockerCommand {
  $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
  if ($dockerCmd) {
    return $dockerCmd.Source
  }

  $fallback = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path $fallback) {
    return $fallback
  }

  throw "Docker CLI not found. Install Docker Desktop or add docker to PATH."
}

function Add-Result {
  param(
    [string]$Step,
    [bool]$Pass,
    [string]$Detail
  )

  $script:results += [PSCustomObject]@{
    Step   = $Step
    Status = if ($Pass) { "PASS" } else { "FAIL" }
    Detail = $Detail
  }
}

$script:results = @()
$docker = Get-DockerCommand
$baseUrl = "http://localhost:4000"
$email = "test$([int](Get-Random -Minimum 100000 -Maximum 999999))@example.com"
$password = "SecureStay123"

Write-Host "Starting services with Docker Compose..."
& $docker compose up -d | Out-Null

Start-Sleep -Seconds 3

try {
  $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
  Add-Result -Step "Gateway health" -Pass $true -Detail ($health | ConvertTo-Json -Compress)
}
catch {
  Add-Result -Step "Gateway health" -Pass $false -Detail $_.Exception.Message
}

if ($script:results[-1].Status -eq "FAIL") {
  $script:results | Format-Table -AutoSize
  exit 1
}

$register = $null
try {
  $register = Invoke-RestMethod `
    -Uri "$baseUrl/api/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{
      fullName = "Integration Tester"
      email    = $email
      password = $password
    } | ConvertTo-Json)
  Add-Result -Step "Register" -Pass $true -Detail "userId=$($register.id)"
}
catch {
  Add-Result -Step "Register" -Pass $false -Detail $_.Exception.Message
  $script:results | Format-Table -AutoSize
  exit 1
}

$login = $null
try {
  $login = Invoke-RestMethod `
    -Uri "$baseUrl/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{
      email    = $email
      password = $password
    } | ConvertTo-Json)

  $hasToken = -not [string]::IsNullOrWhiteSpace($login.accessToken)
  Add-Result -Step "Login" -Pass $hasToken -Detail "tokenType=$($login.tokenType)"
}
catch {
  Add-Result -Step "Login" -Pass $false -Detail $_.Exception.Message
  $script:results | Format-Table -AutoSize
  exit 1
}

$headers = @{ Authorization = "Bearer $($login.accessToken)" }

try {
  $me = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method Get -Headers $headers
  Add-Result -Step "Profile lookup" -Pass $true -Detail "email=$($me.email)"
}
catch {
  Add-Result -Step "Profile lookup" -Pass $false -Detail $_.Exception.Message
}

$hotels = @()
try {
  $hotels = Invoke-RestMethod -Uri "$baseUrl/api/bookings/hotels" -Method Get
  Add-Result -Step "List hotels" -Pass (($hotels | Measure-Object).Count -gt 0) -Detail "count=$(($hotels | Measure-Object).Count)"
}
catch {
  Add-Result -Step "List hotels" -Pass $false -Detail $_.Exception.Message
  $script:results | Format-Table -AutoSize
  exit 1
}

$selectedRoom = $null
$selectedCheckIn = $null
$selectedCheckOut = $null

foreach ($hotel in $hotels) {
  $rooms = Invoke-RestMethod -Uri "$baseUrl/api/bookings/rooms?hotelId=$($hotel.id)" -Method Get

  foreach ($room in $rooms) {
    foreach ($offset in 10..120) {
      $checkIn = (Get-Date).AddDays($offset).ToString("yyyy-MM-dd")
      $checkOut = (Get-Date).AddDays($offset + 2).ToString("yyyy-MM-dd")
      $availability = Invoke-RestMethod -Uri "$baseUrl/api/bookings/availability?roomId=$($room.id)&checkInDate=$checkIn&checkOutDate=$checkOut" -Method Get

      if ($availability.available) {
        $selectedRoom = $room
        $selectedCheckIn = $checkIn
        $selectedCheckOut = $checkOut
        break
      }
    }

    if ($selectedRoom) { break }
  }

  if ($selectedRoom) { break }
}

if (-not $selectedRoom) {
  Add-Result -Step "Find available slot" -Pass $false -Detail "No available room/date found in scan range."
  $script:results | Format-Table -AutoSize
  exit 1
}

Add-Result -Step "Find available slot" -Pass $true -Detail "roomId=$($selectedRoom.id), checkIn=$selectedCheckIn, checkOut=$selectedCheckOut"

$booking = $null
try {
  $booking = Invoke-RestMethod `
    -Uri "$baseUrl/api/bookings/" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body (@{
      roomId       = $selectedRoom.id
      checkInDate  = $selectedCheckIn
      checkOutDate = $selectedCheckOut
      guestCount   = 1
    } | ConvertTo-Json)

  Add-Result -Step "Create booking" -Pass $true -Detail "bookingId=$($booking.id), status=$($booking.status)"
}
catch {
  Add-Result -Step "Create booking" -Pass $false -Detail $_.Exception.Message
  $script:results | Format-Table -AutoSize
  exit 1
}

$payment = $null
try {
  $payment = Invoke-RestMethod `
    -Uri "$baseUrl/api/payments/" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body (@{
      bookingId         = $booking.id
      amount            = $booking.totalAmount
      paymentMethod     = "CARD"
      cardNumber        = "4111111111111111"
      cardHolderName    = "Integration Tester"
      expiryMonth       = 12
      expiryYear        = 2030
      cvv               = "123"
    } | ConvertTo-Json)

  Add-Result -Step "Create payment (success path)" -Pass ($payment.status -eq "SUCCESS") -Detail "paymentId=$($payment.id), status=$($payment.status)"
}
catch {
  Add-Result -Step "Create payment (success path)" -Pass $false -Detail $_.Exception.Message
  $script:results | Format-Table -AutoSize
  exit 1
}

try {
  $bookingAfterPayment = Invoke-RestMethod -Uri "$baseUrl/api/bookings/$($booking.id)" -Method Get -Headers $headers
  Add-Result -Step "Booking status after success payment" -Pass ($bookingAfterPayment.status -eq "CONFIRMED") -Detail "status=$($bookingAfterPayment.status)"
}
catch {
  Add-Result -Step "Booking status after success payment" -Pass $false -Detail $_.Exception.Message
}

# Failure-path check with a second booking.
$secondSlotFound = $false
$failedBooking = $null

foreach ($offset in 130..220) {
  $checkIn = (Get-Date).AddDays($offset).ToString("yyyy-MM-dd")
  $checkOut = (Get-Date).AddDays($offset + 2).ToString("yyyy-MM-dd")
  $availability = Invoke-RestMethod -Uri "$baseUrl/api/bookings/availability?roomId=$($selectedRoom.id)&checkInDate=$checkIn&checkOutDate=$checkOut" -Method Get

  if ($availability.available) {
    $failedBooking = Invoke-RestMethod `
      -Uri "$baseUrl/api/bookings/" `
      -Method Post `
      -Headers $headers `
      -ContentType "application/json" `
      -Body (@{
        roomId       = $selectedRoom.id
        checkInDate  = $checkIn
        checkOutDate = $checkOut
        guestCount   = 1
      } | ConvertTo-Json)
    $secondSlotFound = $true
    break
  }
}

if (-not $secondSlotFound) {
  Add-Result -Step "Prepare failed payment path" -Pass $false -Detail "Could not create second booking for failure-path validation."
  $script:results | Format-Table -AutoSize
  exit 1
}

try {
  $failedPayment = Invoke-RestMethod `
    -Uri "$baseUrl/api/payments/" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body (@{
      bookingId         = $failedBooking.id
      amount            = $failedBooking.totalAmount
      paymentMethod     = "CARD"
      cardNumber        = "4111111111111111"
      cardHolderName    = "Integration Tester"
      expiryMonth       = 12
      expiryYear        = 2030
      cvv               = "000"
    } | ConvertTo-Json)

  $failedBookingAfterPayment = Invoke-RestMethod -Uri "$baseUrl/api/bookings/$($failedBooking.id)" -Method Get -Headers $headers
  $failedPathOk = ($failedPayment.status -eq "FAILED" -and $failedBookingAfterPayment.status -eq "FAILED")
  Add-Result -Step "Failed payment path" -Pass $failedPathOk -Detail "payment=$($failedPayment.status), booking=$($failedBookingAfterPayment.status)"
}
catch {
  Add-Result -Step "Failed payment path" -Pass $false -Detail $_.Exception.Message
}

try {
  Start-Sleep -Seconds 2
  $notifications = Invoke-RestMethod -Uri "http://localhost:4004/notifications" -Method Get
  $eventTypes = @($notifications | ForEach-Object { $_.payload.eventType })
  $hasBookingCreated = $eventTypes -contains "booking.created"
  $hasPaymentProcessed = $eventTypes -contains "payment.processed"
  Add-Result -Step "Notification events consumed" -Pass ($hasBookingCreated -and $hasPaymentProcessed) -Detail "booking.created=$hasBookingCreated, payment.processed=$hasPaymentProcessed"
}
catch {
  Add-Result -Step "Notification events consumed" -Pass $false -Detail $_.Exception.Message
}

$script:results | Format-Table -AutoSize

$failedCount = ($script:results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
if ($failedCount -gt 0) {
  exit 1
}

Write-Host ""
Write-Host "Integration smoke test completed successfully."
