const express = require("express");
// CORS
const cors = require("cors");
// DOT ENV
require("dotenv").config();
// MONGO DB
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// MAKE APP
const app = express();
// running port
const port = process.env.PORT || 5001;

// middle ware
app.use(cors());
app.use(express.json());

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
    // electronics db and collection are included
    const db = client.db("du-electronics");
    const productCollection = db.collection("products");
    const cartCollection = db.collection("carts");

    // get products
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // carts api
    app.get("/carts", async (req, res) => {
      try{
        const result = await cartCollection.find().toArray();
        const count = await cartCollection.estimatedDocumentCount();
        res.send({data: result, count})
      }catch(error){
        console.log(error);
      }
    })
    app.post("/carts", async (req, res) => {
      try {
        const { id } = req.body;
        const productId = new ObjectId(id);
        const query = {_id: productId}

        // find item form product collection 
        const cartProduct = await productCollection.findOne(query);
        
        // check item isExist on cart collection 
        const isExist = await cartCollection.findOne(query);
      
        if (!isExist) {
          const result = await cartCollection.insertOne({...cartProduct, quantity: 1});
          return res.send(result);
          
        }else{
          const result = await cartCollection.updateOne(query, {$set: {quantity: isExist?.quantity + 1}})
        }

        // add item to cart collection 
        
        
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
