const adsTxt = "google.com, pub-5490654987125120, DIRECT, f08c47fec0942fa0\n";

export function GET() {
  return new Response(adsTxt, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
