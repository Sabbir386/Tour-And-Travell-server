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
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

//sslcommerz init
app.get('/ssl-request', (req, res) => {
  const data = {
      total_amount: 6600,
      currency: 'EUR',
      tran_id: 'REF123',
      success_url: `${process.env.ROOT}/ssl-payment-success`,
      fail_url:  `${process.env.ROOT}/ssl-payment-failure`,
      cancel_url:  `${process.env.ROOT}/ssl-payment-cancel`,
      ipn_url:  `${process.env.ROOT}/ssl-payment-ipn`,
      shipping_method: 'Courier',
      product_name: 'Computer.',
      product_category: 'Electronic',
      product_profile: 'general',
      cus_name: 'Customer Name',
      cus_email: 'cust@yahoo.com',
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01711111111',
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
      multi_card_name: 'mastercard',
      value_a: 'ref001_A',
      value_b: 'ref002_B',
      value_c: 'ref003_C',
      value_d: 'ref004_D'
  };
  const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD,false) //true for live default false for sandbox
  sslcommer.init(data).then(data => {
      //process the response that got from sslcommerz 
      //https://developer.sslcommerz.com/doc/v4/#returned-parameters
      if (data?.GatewayPageURL) {
        return res.status(200).redirect(data?.GatewayPageURL);
      }
      else {
        return res.status(400).json({
          message: "Session was not successful"
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
  return res.status(200).redirect('http://localhost:3000/');
});
app.post("/ssl-payment-fail", async (req, res) => {

  /** 
  * If payment failed 
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment failed'
    }
  );
});
app.post("/ssl-payment-cancel", async (req, res) => {

  /** 
  * If payment cancelled 
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment cancelled'
    }
  );
});
app.post("/ssl-payment-ipn", async (req, res) => {

  /** 
  * If payment cancelled 
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment cancelled'
    }
  );
});

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
