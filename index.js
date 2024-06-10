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
    const DonatedListCollection = client.db("PetDB").collection("DonatedList");
    const AdoptionRequestCollection = client.db("PetDB").collection("AdoptionRequest");
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
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      if (!price) {
        return res.status(400).send({ message: 'Price is required' });
      }

      try {
        const amount = parseInt(price * 100);
        console.log(`Creating payment intent for amount: ${amount}`);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Update Pet by Id
    app.put('/updatePet/:id', async (req, res) => {
      const id = req.params.id;
      const updatedPet = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedPet,
      };

      try {
        const result = await PetListingDetailsCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Pet not found' });
        }
        res.send(result);
      } catch (error) {
        console.error('Error updating pet:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Update Pet by Id
    app.put('/updateDonationCampaign/:id', async (req, res) => {
      const id = req.params.id;
      const updatedDonationCampaign = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedDonationCampaign,
      };

      try {
        const result = await DonationCampaignsDetailsCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Pet not found' });
        }
        res.send(result);
      } catch (error) {
        console.error('Error updating pet:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });


    // Add Pet
    app.post('/addPet', async (req, res) => {
      const pet = req.body;
      console.log('new pet', pet);
      const result = await PetListingDetailsCollection.insertOne(pet);
      res.send(result);
    });

    // Add Adoption Request
    app.post('/addAdoptionRequest', async (req, res) => {
      const adoptionRequest = req.body;
      console.log('new adoption request', adoptionRequest);
      const result = await AdoptionRequestCollection.insertOne(adoptionRequest);
      res.send(result);
    });

    // Add Donation Campaign
    app.post('/addDonationCampaign', async (req, res) => {
      const donationCampaign = req.body;
      console.log('new donation campaign', donationCampaign);
      const result = await DonationCampaignsDetailsCollection.insertOne(donationCampaign);
      res.send(result);
    });

    // Add Donated List
    app.post('/addDonatedList', async (req, res) => {
      const donation = req.body;
      console.log('new pet', donation);
      const result = await DonatedListCollection.insertOne(donation);
      res.send(result);
    });


    // ADD Donated Amount
    app.put('/addDonatedAmount/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedDonationCampaign = req.body;
      const food = {
        $set: {
          donatedAmount: updatedDonationCampaign.donatedAmount,

        }
      }
      const result = await DonationCampaignsDetailsCollection.updateOne(filter, food, options);
      res.send(result);
    });



    // * Get Pet by Email
    app.get('/myPet/:ownerEmail', logger, async (req, res) => {
      const ownerEmail = req.params.ownerEmail;
      const query = { ownerEmail: ownerEmail };
      const cursor = PetListingDetailsCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });


    // * Get Pet by Email
    app.get('/myAdoptionRequest/:ownerEmail', logger, async (req, res) => {
      const ownerEmail = req.params.ownerEmail;
      const query = { ownerEmail: ownerEmail };
      const cursor = AdoptionRequestCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });


    // * Get Donation Campaign by Email
    app.get('/myDonationCampaign/:ownerEmail', logger, async (req, res) => {
      const ownerEmail = req.params.ownerEmail;
      const query = { ownerEmail: ownerEmail };
      const cursor = DonationCampaignsDetailsCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });


    // * Get Donators by campaign id
    app.get('/donator/:donationCampaignId', logger, async (req, res) => {
      const donationCampaignId = req.params.donationCampaignId;
      const query = { donationCampaignId: donationCampaignId };
      const cursor = DonatedListCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    // * Get My Donation by Donator Email
    app.get('/myDonation/:donatorEmail', logger, async (req, res) => {
      const donatorEmail = req.params.donatorEmail;
      const query = { donatorEmail: donatorEmail };
      const cursor = DonatedListCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    // Delete donation by Id
    app.delete('/donationDelete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await DonatedListCollection.deleteOne(query);
      res.send(result);
    });


    // Delete Pet by Id
    app.delete('/petDelete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await PetListingDetailsCollection.deleteOne(query);
      res.send(result);
    });

    // Update Adopted Status
    app.put('/petUpdateAdoptedStatus/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const status = req.body;
      console.log(status);
      const pet = {
        $set: {
          adopted: status.adopted,
        }
      }
      const result = await PetListingDetailsCollection.updateOne(filter, pet, options);
      res.send(result);
    });


    // Update Accept Reject Adoption Request
    app.put('/acceptRejectAdoptionRequest/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const status = req.body;
      console.log(status);
      const pet = {
        $set: {
          isAcceptedRequest: status.isAcceptedRequest,
        }
      }
      const result = await AdoptionRequestCollection.updateOne(filter, pet, options);
      res.send(result);
    });

    // Update Pause Status
    app.put('/updateDonationCampaignStatus/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const status = req.body;
      console.log(status);
      const pet = {
        $set: {
          isPause: status.isPause,
        }
      }
      const result = await DonationCampaignsDetailsCollection.updateOne(filter, pet, options);
      res.send(result);
    });



    // Get Pet Details
    app.get('/petDetails/:id', logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await PetListingDetailsCollection.findOne(query);
      res.send(result);
    });

    // Get Donation Campaign Details by ID
    app.get('/donationCampaignDetailsById/:id', logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await DonationCampaignsDetailsCollection.findOne(query);
      res.send(result);
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

    // GET /DonationCampaignsDetails 
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
