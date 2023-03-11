const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { query } = require("express");

const app = express();



app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7dm94fg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const hotelsCollection = client.db("tour").collection("hotels");
    const bookingsCollection = client.db("tour").collection("bookings");

    app.get("/hotels", async (req, res) => {
      const query = {};
      const result = await hotelsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/hotels/search", async (req, res) => {
      const name = req.query.name;
      const money = req.query.money;
      const query = {
        $or: [
          { title: { $regex: new RegExp(name, "i") } },
          { price: { $lte: money } },
        ],
      };
      const result = await hotelsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/hotels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { title: id };
      const booking = await hotelsCollection.findOne(query);
      res.send(booking);
    });
    app.get("/bookings", async (req, res) => {
      const query = {};
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/bookings", async (req, res) => {
      const product = req.body;
      const result = await bookingsCollection.insertOne(product);
      res.send(result);
    });
 
    
  } finally {
  }
}
run().catch(console.log);
app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
