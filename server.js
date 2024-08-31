const express = require('express');
const routes = require('./routes/index');

const app = express();
const port = 5000 || process.env.PORT;

app.use(express.json());
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
