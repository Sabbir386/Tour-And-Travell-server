const express = require("express");
const bodyParser = require("body-parser");
const SSLCommerzPayment = require("sslcommerz-lts");
const cors = require("cors");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { query } = require("express");

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7dm94fg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const hotelsCollection = client.db("tour").collection("hotels");
    const bookingsCollection = client.db("tour").collection("bookings");
    const usersCollection = client.db("tour").collection("users");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };

      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbiden Access" });
      }
      next();
    };

    app.get("/user-count", async (req, res) => {
      const query = { status: "verified" };
      const total = await bookingsCollection.find(query).count();
      res.send({ userCount: total });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollection.count(query);
      res.send({ feedback: result });
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //sslcommerz init
    app.get("/ssl-request", async (req, res) => {
      const id = req.query.infos;
      const query = { _id: new ObjectId(id) };
      const product = await bookingsCollection.findOne(query);
      console.log(product);
      const data = {
        total_amount: product.amount,
        currency: "BDT",
        tran_id: 'product._id',
        success_url: `http://localhost:3000/`,
        fail_url: "http://localhost:3030/fail",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        cus_name: 'product.fname' ,
        cus_email: 'product.email',
        cus_add1: 'product.address',
        cus_phone: 'product.phone',
      };
      const sslcommer = new SSLCommerzPayment(
        process.env.STORE_ID,
        process.env.STORE_PASSWORD,
        false
      ); //true for live default false for sandbox
      sslcommer.init(data).then((data) => {
        //process the response that got from sslcommerz
        //https://developer.sslcommerz.com/doc/v4/#returned-parameters
        if (data?.GatewayPageURL) {
          return res.status(200).redirect(data?.GatewayPageURL);
        } else {
          return res.status(400).json({
            message: "Session was not successful",
          });
        }
      });
    });
    app.post("/ssl-payment-success", async (req, res) => {
      /**
       * If payment successful
       */

      // return res.status(200).json(
      //   {
      //     data: req.body,
      //     message: 'Payment success'
      //   }
      // );
      return res.status(200).redirect("http://localhost:3000/");
    });
    app.post("/ssl-payment-fail", async (req, res) => {
      /**
       * If payment failed
       */

      return res.status(200).json({
        data: req.body,
        message: "Payment failed",
      });
    });
    app.post("/ssl-payment-cancel", async (req, res) => {
      /**
       * If payment cancelled
       */

      return res.status(200).json({
        data: req.body,
        message: "Payment cancelled",
      });
    });
    app.post("/ssl-payment-ipn", async (req, res) => {
      /**
       * If payment cancelled
       */

      return res.status(200).json({
        data: req.body,
        message: "Payment cancelled",
      });
    });

    app.get("/hotels", async (req, res) => {
      const query = {};
      const result = await hotelsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/hotels/search", async (req, res) => {
      const name = req.query.name;
      const money = req.query.money;
      if(money === ''){
        const query = {
          $or: [
            { title: { $regex: new RegExp(name, "i") } },
            // { price: { $lte: parseInt(money) } },
          ],
        };
        const result = await hotelsCollection.find(query).toArray();
        res.send(result);
      }else if(name === ''){
        const query = {
          $or: [
            // { title: { $regex: new RegExp(name, "i") } },
            { price: { $lte: parseInt(money) } },
          ],
        };
        const result = await hotelsCollection.find(query).toArray();
        res.send(result);
      }else{
        const query = {
          $and: [
            { title: { $regex: new RegExp(name, "i") } },
            { price: { $lte: parseInt(money) } },
          ],
        };
        const result = await hotelsCollection.find(query).toArray();
        res.send(result);
      }
      
    });
    app.get("/hotels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const booking = await hotelsCollection.findOne(query);
      res.send(booking);
    });
    app.get("/bookings", async (req, res) => {
      const query = {};
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/informations/:id", async (req, res) => {
      const email = req.params.id;
      const query = {email: email};
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const product = req.body;
      const result = await bookingsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "5h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
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
