const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:5173',],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB URI and Client Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.mj6vep2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middleware
const logger = async (req, res, next) => {
  console.log('called:', req.host, req.originalUrl)
  next();
}
// const verifyToken = (req, res, next) => {
//   // const token = req.cookies?.token;
//   console.log('Inside Verify Token', req.headers);
//   if (!req.headers.authorization) {
//     return res.status(401).send({ message: 'Forbidden Access' });
//   }
//   const token = req.headers.authorization.split(' ')[1];
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     //error
//     if (err) {
//       return res.status(401).send({ message: 'Forbidden Access' })
//     }
//     // console.log('value in the token decoded', decoded)
//     req.decoded = decoded;
//     next();
//   })

// };

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Collections
    const PetListingDetailsCollection = client.db("PetDB").collection("PetListingDetails");
    const DonationCampaignsDetailsCollection = client.db("PetDB").collection("DonationCampaignsDetails");
    const UserCollection = client.db("PetDB").collection("User");

    // jwt related api
    //auth provider
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      // res.send({token});
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
        .send({ success: true })
    })

    //logout
    app.post('/logout', logger, async (req, res) => {
      const user = req.body;
      console.log('Logging Out', user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })

    // POST /User - Create a new user
    app.post('/User', logger, async (req, res) => {
      const { email, name, role } = req.body;

      if (!email || !name || !role) {
        return res.status(400).send({ message: 'Email, name and role are required' });
      }

      try {
        const query = { email: email };
        const existingUser = await UserCollection.findOne(query);

        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }
        // console.log(req.headers);
        const result = await UserCollection.insertOne({ email, name, role });
        res.send(result);
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Payment Intent
    app.post('/create-payment-intent', async(req,res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    // Add Pet
    app.post('/addPet', async (req, res) => {
      const pet = req.body;
      console.log('new pet', pet);
      const result = await PetListingDetailsCollection.insertOne(pet);
      res.send(result);
    });

    // * Get Pet by Email
    app.get('/myFood/:ownerEmail', logger, async (req, res) => {
      const ownerEmail = req.params.ownerEmail;
      const query = { ownerEmail: ownerEmail };
      const cursor = PetListingDetailsCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    // GET /PetListingDetails - Retrieve all pet listing details
    app.get('/PetListingDetails', logger, async (req, res) => {
      try {
        const result = await PetListingDetailsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving pet listing details:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // GET /DonationCampaignsDetails - Retrieve all donation campaign details
    app.get('/DonationCampaignsDetails', logger, async (req, res) => {
      try {
        const result = await DonationCampaignsDetailsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving donation campaigns details:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Pet Adoption');
});

app.listen(port, () => {
  console.log(`Pet Adoption Running on Port ${port}`);
});
