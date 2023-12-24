const express = require("express");
// CORS
const cors = require("cors");
// DOT ENV
require("dotenv").config();
//jwt
const jwt = require("jsonwebtoken");
// MONGO DB
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// MAKE APP
const app = express();
//ssl commerz
const SSLCommerzPayment = require("sslcommerz-lts");
// running port
const port = process.env.PORT || 5001;

// SSL commerz =======================
// store id
const store_id = process.env.STORE_ID;
//store password
const store_passwd = process.env.STORE_PASS;
//true for live, false for sandbox
const is_live = false;

// middleware
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
  const bearer_token = req.headers?.authorization;
  const token = bearer_token.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "unauthorize access" });
    } else {
      req.user = decoded.email;
      next();
    }
  });
};

// mongodb connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zav38m0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    // electronics db and collection are included
    const db = client.db("du-electronics");
    const productCollection = db.collection("products");
    const cartCollection = db.collection("carts");
    const favouriteCollection = db.collection("favourites");
    const userCollection = db.collection("users");
    const paymentCollection = db.collection("payments");

    // jwt apis ===========================

    app.post("/access-token", async (req, res) => {
      try {
        const payload = req.body;
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });
        res.send(token);
      } catch (error) {
        console.log(error);
      }
    });

    // get products==============================
    app.get("/products", async (req, res) => {
      try {
        const limit = Number(req.query?.size);
        const pageNumber = Number(req.query?.page);
        const skip = limit * pageNumber;
        const count = await productCollection.estimatedDocumentCount();
        const result = await productCollection
          .find({})
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ result, count });
      } catch (error) {
        console.log(error);
      }
    });
    // get single product by id
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params?.id;
        console.log(id, "form single product");
        const productId = new ObjectId(id);
        const query = { _id: productId };
        const result = await productCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.post(`/products`, verifyToken, async (req, res) => {
      try {
        const product = req.body;
        const result = await productCollection.insertOne(product);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // carts api=========================================
    app.get("/carts", verifyToken, async (req, res) => {
      try {
        const email = req.query?.email;
        const query = {
          email,
        };
        const result = await cartCollection.find(query).toArray();
        const count = await cartCollection.estimatedDocumentCount();
        res.send({ data: result, count });
      } catch (error) {
        console.log(error);
      }
    });
    app.post("/carts", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const { id } = req.body;
        const productId = new ObjectId(id);
        const query = { _id: productId };

        // find item form product collection
        const cartProduct = await productCollection.findOne(query);

        // check item isExist on cart collection
        const isExist = await cartCollection.findOne(query);

        if (!isExist) {
          // insert item
          const result = await cartCollection.insertOne({
            ...cartProduct,
            quantity: 1,
            email: email,
          });
          return res.send(result);
        } else {
          // update item
          const result = await cartCollection.updateOne(query, {
            $set: { quantity: isExist?.quantity + 1 },
          });
          return res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });
    app.delete(`/carts`, verifyToken, async (req, res) => {
      try {
        const id = req?.query?.id;
        const query = { _id: new ObjectId(id) };
        if (id) {
          const result = await cartCollection.deleteOne(query);
          return res.send(result);
        } else {
          const result = await cartCollection.deleteMany({});
          return res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // favourite apis======================================================
    app.get("/favourites", verifyToken, async (req, res) => {
      try {
        const email = req.query?.email;
        console.log(email);
        const query = { email: email };
        const result = await favouriteCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    app.post("/favourites", verifyToken, async (req, res) => {
      try {
        const { id } = req.body;
        const { email } = req.body;
        console.log(email, id, "favourite");
        const productId = new ObjectId(id);
        const query = { _id: productId };

        // find item form product collection
        const cartProduct = await productCollection.findOne(query);

        // check item isExist on cart collection
        const isExist = await favouriteCollection.findOne(query);

        if (!isExist) {
          // insert item
          const result = await favouriteCollection.insertOne({
            ...cartProduct,
            email,
            quantity: 1,
          });
          return res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });
    // delete favoueite
    app.delete("/favourites/:id", verifyToken, async (req, res) => {
      try {
        const id = req?.params?.id;
        console.log(id, "delete fav");
        const query = { _id: new ObjectId(id) };

        const result = await favouriteCollection.deleteOne(query);
        return res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    // user related api here ==============================

    app.get("/users", async (req, res) => {
      try {
        const email = req.query.email;
        console.log(email);
        const query = {};
        if (email) {
          query.email = email;
        }
        console.log(query);
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const data = req.body;
        const query = { email: data?.email };
        const date = new Date();
        const isExist = await userCollection.findOne(query);
        if (isExist?.email) {
          return;
        }
        const user = { ...data, createdAt: date.toGMTString(), role: "user" };
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req?.params?.id;
        const query = { _id: new ObjectId(id) };
        if (id) {
          const result = await userCollection.deleteOne(query);
          res.send(result);
        } else {
          res.status(400).send({ message: "user not found" });
        }
      } catch (err) {
        console.log(err);
      }
    });
    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req?.params?.id;
        const role = req?.query?.role;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: role,
          },
        };
        if (id) {
          const result = await userCollection.updateOne(query, updatedDoc);
          res.send(result);
        } else {
          res.status(400).send({ message: "user not found" });
        }
      } catch (err) {
        console.log(err);
      }
    });
    // payment related apis =========================================
    app.post("/payment", async (req, res) => {
      const tran_id = new ObjectId().toString();
      try {
        const pay_info = req.body;
        const data = {
          total_amount: pay_info?.price,
          currency: pay_info?.currency,
          tran_id: tran_id, // use unique tran_id for each api call
          success_url: `http://localhost:5001/paymnet/success/${tran_id}`,
          fail_url: `http://localhost:5001/paymnet/fail/${tran_id}`,
          cancel_url: "http://localhost:3030/cancel",
          ipn_url: "http://localhost:3030/ipn",
          shipping_method: "Courier",
          product_name: "Computer.",
          product_category: "Electronic",
          product_profile: "general",
          cus_name: pay_info?.name,
          cus_email: pay_info?.user_email,
          cus_add1: pay_info?.address,
          cus_add2: pay_info?.address,
          cus_city: pay_info?.address,
          cus_state: pay_info?.address,
          cus_postcode: pay_info?.postCode || "not provided",
          cus_country: pay_info?.address,
          cus_phone: pay_info?.phone,
          cus_fax: "01711111111",
          ship_name: pay_info?.name,
          ship_add1: pay_info?.address,
          ship_add2: pay_info?.address,
          ship_city: pay_info?.address,
          ship_state: pay_info?.address,
          ship_postcode: pay_info?.postCode || "not provided",
          ship_country: pay_info?.address,
        };
        // initialize ssl commerz
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        sslcz.init(data).then((apiResponse) => {
          // Redirect the user to payment gateway
          let GatewayPageURL = apiResponse.GatewayPageURL;
          res.send({ url: GatewayPageURL });
          const finalOrder = {
            ...pay_info,
            tran_id,
            paid_status: false,
          };
          // save payment to db
          paymentCollection.insertOne(finalOrder);
        });
      } catch (error) {
        console.log(error);
      }
    });

    app.post("/paymnet/success/:tranId", async (req, res) => {
      try {
        const query = { tran_id: req?.params?.tranId };
        const result = await paymentCollection.updateOne(query, {
          $set: { paid_status: true },
        });

        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/payment/success/${req?.params?.tranId}`
          );
        } else {
          res.redirect(
            `http://localhost:5173/payment/fail/${req?.params?.tranId}`
          );
        }
      } catch (error) {
        console.log(error);
      }
    });
    app.post("/paymnet/fail/:tranId", async (req, res) => {
      try {
        const query = { tran_id: req?.params?.tranId };
        const result = await paymentCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.redirect(
            `http://localhost:5173/payment/fail/${req?.params?.tranId}`
          );
        }
      } catch (error) {
        console.log(error);
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("e-commerce server is running! ");
});

app.listen(port, () => {
  console.log(`E-commerce server is running in PORT: ${port}`);
});
