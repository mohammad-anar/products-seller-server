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
// running port
const port = process.env.PORT || 5001;

// middleware
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
  const bearer_token = req.headers?.authorization;
  const token = bearer_token.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(403).send({message: "unauthorize access"})
    }else{
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
    await client.connect();
    // electronics db and collection are included
    const db = client.db("du-electronics");
    const productCollection = db.collection("products");
    const cartCollection = db.collection("carts");
    const favouriteCollection = db.collection("favourites");
    const userCollection = db.collection("users");

    // jwt apis ===========================

    app.post("/access-token", async (req, res) => {
      const payload = req.body;
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send(token);
    });

    // get products==============================
    app.get("/products", async (req, res) => {
      const limit = Number(req.query?.size);
      const pageNumber= Number(req.query?.page);
      const skip = limit * pageNumber;
      const count = await productCollection.estimatedDocumentCount();
      const result = await productCollection.find({}).skip(skip).limit(limit).toArray();
      res.send({result, count});
    });
    // get single product by id
    app.get("/products/:id", async (req, res) => {
      const id = req.params?.id;
      console.log(id, "form single product");
      const productId = new ObjectId(id);
      const query = { _id: productId };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // carts api=========================================
    app.get("/carts", verifyToken, async (req, res) => {
      try {
        const email = req.query?.email;
        const query = {
          email
        }
        const result = await cartCollection.find(query).toArray();
        const count = await cartCollection.estimatedDocumentCount();
        res.send({ data: result, count });
      } catch (error) {
        console.log(error);
      }
    });
    app.post("/carts",verifyToken, async (req, res) => {
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

    // favourite apis
    app.get("/favourites", verifyToken, async (req, res) => {
      try {
        const result = await favouriteCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });
    app.post("/favourites", verifyToken, async (req, res) => {
      try {
        const { id } = req.body;
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
            quantity: 1,
          });
          return res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });
    // delete favoueite
    app.delete("/favourites/:id",verifyToken, async (req, res) => {
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

    app.post("/users", async (req, res) => {
      const data = req.body;
      const date = new Date();
      const user = {...data, createdAt: date.toGMTString(), role: "user"}
      const result = await userCollection.insertOne(user);
      res.send(result);
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
