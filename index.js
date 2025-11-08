// simple HTTP app that prints a message
const http = require('http');

const message = 'Hello from ci-node-sample!';

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(message + '\n');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
