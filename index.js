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
    const roomsCollection = client.db("tour").collection("rooms");
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
    app.get("/dashboard", async (req, res) => {
      const email = req.query.email;
      const userInfo = await usersCollection.findOne({ email: email });
      if (userInfo.role === "admin") {
        const query = {};
        const paidQuery = { status: "paid" };
        const dueQuery = { status: "unpaid" };
        const hotelCount = await hotelsCollection.find(query).count();
        const bookingCount = await bookingsCollection.find(query).count();
        const paidTotal = await bookingsCollection
          .aggregate([
            {
              $match: paidQuery,
            },
            {
              $group: { _id: null, total: { $sum: "$amount" } },
            },
          ])
          .toArray();
        const dueTotal = await bookingsCollection
          .aggregate([
            {
              $match: dueQuery,
            },
            {
              $group: { _id: null, total: { $sum: "$amount" } },
            },
          ])
          .toArray();
        const userBooking = await bookingsCollection
          .aggregate([
            {
              $lookup: {
                from: "users",
                localField: "email",
                foreignField: "email",
                as: "branch",
              },
            },
            {
              $unwind: "$branch",
            },
            {
              $group: {
                _id: "$branch",
                total: { $count: {} },
              },
            },

            // {
            //   $group: { _id: "$user", total: { $count: {} } },
            // },
          ])
          .toArray();
        const hotelBooking = await bookingsCollection
          .aggregate([
            {
              $group: { _id: "$hotel", total: { $count: {} } },
            },
          ])
          .toArray();

        res.send({
          hotelCount: hotelCount,
          bookingCount: bookingCount,
          paidTotal: paidTotal[0].total,
          dueTotal: dueTotal[0].total,
          userBooking: userBooking,
          hotelBooking: hotelBooking,
        });
      } else {
        const query = {};
        const paidQuery = { status: "paid", email: email };
        const dueQuery = { status: "unpaid", email: email };
        const hotelCount = await hotelsCollection.find(query).count();
        const bookingCount = await bookingsCollection
          .find({ email: email })
          .count();
        const paidTotal = await bookingsCollection
          .aggregate([
            { $match: { $and: [{ email: email }, { status: "paid" }] } },

            {
              $group: { _id: null, total: { $sum: "$amount" } },
            },
          ])
          .toArray();
        const dueTotal = await bookingsCollection
          .aggregate([
            { $match: { $and: [{ email: email }, { status: "unpaid" }] } },
            {
              $group: { _id: null, total: { $sum: "$amount" } },
            },
          ])
          .toArray();
        const userBooking = await bookingsCollection
          .aggregate([
            {
              $match: { email: email },
            },
            {
              $lookup: {
                from: "users",
                localField: "email",
                foreignField: "email",
                as: "branch",
              },
            },
            {
              $unwind: "$branch",
            },
            {
              $group: {
                _id: "$branch",
                total: { $count: {} },
              },
            },

            // {
            //   $group: { _id: "$user", total: { $count: {} } },
            // },
          ])
          .toArray();
          let hotelBooking;
          if (userInfo.role === "admin") {
             hotelBooking = await bookingsCollection
            .aggregate([
              {
                $group: { _id: "$hotel", total: { $count: {} } },
              },
            ])
            .toArray();
          }else{
             hotelBooking = await bookingsCollection
            .aggregate([
              {
                $match: { email: email },
              },
              {
                $group: { _id: "$hotel", total: { $count: {} } },
              },
            ])
            .toArray();
          }
        

        res.send({
          hotelCount: hotelCount,
          bookingCount: bookingCount,
          paidTotal: paidTotal[0]?.total,
          dueTotal: dueTotal[0]?.total,
          userBooking: userBooking,
          hotelBooking: hotelBooking,
        });
      }
    });
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

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "paid",
        },
      };
      const result = await bookingsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );

      const data = {
        total_amount: parseInt(product.amount),
        currency: "BDT",
        tran_id: "product._id", // use unique tran_id for each api call
        success_url: "https://tourtravel-51405.web.app/",
        fail_url: "http://localhost:3000/fail",
        cancel_url: "http://localhost:3000/cancel",
        ipn_url: "http://localhost:3000/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: product.fname,
        cus_email: product.email,
        cus_add1: product.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(
        process.env.STORE_ID,
        process.env.STORE_PASSWORD,
        false
      );
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.redirect(GatewayPageURL);
        console.log("Redirecting to: ", GatewayPageURL);
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
      // return res.status(200).redirect("http://localhost:3000/");
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

    app.post("/hotels", async (req, res) => {
      const hotels = req.body;
      const result = await hotelsCollection.insertOne(hotels);
      res.send(result);
    });
    app.get("/hotels", async (req, res) => {
      const query = {};
      const result = await hotelsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/rooms", async (req, res) => {
      const rooms = req.body;
      const result = await roomsCollection.insertOne(rooms);
      res.send(result);
    });
    app.get("/rooms", async (req, res) => {
      const query = {};
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { hotelId: id };
      const booking = await roomsCollection.find(query).toArray();
      res.send(booking);
    });
    app.get("/hotels/search", async (req, res) => {
      const name = req.query.name;
      const money = req.query.money;
      if (money === "") {
        const query = {
          $or: [
            { title: { $regex: new RegExp(name, "i") } },
            // { price: { $lte: parseInt(money) } },
          ],
        };
        const result = await hotelsCollection.find(query).toArray();
        res.send(result);
      } else if (name === "") {
        const query = {
          $or: [
            // { title: { $regex: new RegExp(name, "i") } },
            { price: { $lte: parseInt(money) } },
          ],
        };
        const result = await hotelsCollection.find(query).toArray();
        res.send(result);
      } else {
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
      const query = { _id: new ObjectId(id) };
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
      const userInfo = await usersCollection.findOne({ email: email });
      if (userInfo.role === "admin") {
        const query = {};
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } else {
        const query = { email: email };
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      }
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

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
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
