const http = require('http');
const next = require('next');

const port = Number.parseInt(process.env.PORT || '3000', 10);
// Passenger provides the public routing. The Node process should listen on all
// interfaces rather than binding to the hosting machine's hostname.
const hostname = '0.0.0.0';
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = http.createServer((req, res) => handle(req, res));

    server.listen(port, hostname, () => {
      console.log(`BookingModel production server listening on ${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Could not start BookingModel:', error);
    process.exit(1);
  });
