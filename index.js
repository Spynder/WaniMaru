const express = require("express");
const app = express();
require("dotenv").config();
app.use(express.static(__dirname + "/assets"));
const port = process.env.PORT || 5000;

app.get("/", async (req, res) => {
	res.sendFile("index.html", {root: __dirname});
});

app.listen(port, () => {
 	console.log(`WaniMaru online at port ${port}`);
});




// API
