const express = require("express");
const path = require("path");
const { Readable } = require("stream");

const app = express();
const port = Number(process.env.PORT || 3000);
const apiGatewayUrl = process.env.API_GATEWAY_URL || "http://api-gateway:4000";

app.use("/api", async (req, res) => {
  try {
    const upstreamUrl = new URL(req.originalUrl, apiGatewayUrl);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value && key.toLowerCase() !== "host") {
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: req.method === "GET" || req.method === "HEAD" ? undefined : "half"
    });

    res.status(upstreamResponse.status);

    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    if (upstreamResponse.body) {
      Readable.fromWeb(upstreamResponse.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    res.status(502).json({ message: "API proxy error", error: error.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "frontend" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Frontend listening on port ${port}`);
});
