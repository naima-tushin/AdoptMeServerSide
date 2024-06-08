const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI and Client Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.mj6vep2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Collections
    const PetListingDetailsCollection = client.db("PetDB").collection("PetListingDetails");
    const DonationCampaignsDetailsCollection = client.db("PetDB").collection("DonationCampaignsDetails");
    const UserCollection = client.db("PetDB").collection("User");

    // POST /User - Create a new user
    app.post('/User', async (req, res) => {
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

        const result = await UserCollection.insertOne({ email, name, role });
        res.send(result);
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // GET /PetListingDetails - Retrieve all pet listing details
    app.get('/PetListingDetails', async (req, res) => {
      try {
        const result = await PetListingDetailsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving pet listing details:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // GET /DonationCampaignsDetails - Retrieve all donation campaign details
    app.get('/DonationCampaignsDetails', async (req, res) => {
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
