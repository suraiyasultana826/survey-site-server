const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4dyvkgp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const surveyCollection = client.db('surveySite').collection('surveys');
        const userCollection = client.db('surveySite').collection('users');
        const surveyCompletionCollection = client.db('surveySite').collection("completed");
        const paymentCollection = client.db('surveySite').collection("payments");

        //jwt related api

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })
        app.get('/surveys', async (req, res) => {
            const cursor = surveyCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })


        //middlewares
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded;
                next();
            })
        }
        //use verify token after verifyToken

        const verifyAdmin = async(req, res, next)=>{
            const email = req.decoded.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if(!isAdmin){
                return res.status(403).send({ message: 'forbidden access'});
            }
            next();
        }


        //user related api

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            console.log(req.headers);
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        //created survey

        app.post('/surveys', async (req, res) => {
            const created = req.body;
            console.log(created);
            const result = await surveyCollection.insertOne(created);
            res.send(result);
        })

        app.get('/surveys/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {

                projection: { image: 1, category: 1, voted: 1, description: 1, questionOne: 1, questionTwo: 1, questionThree: 1, title: 1, imdb: 1 },
            };
            const result = await surveyCollection.findOne(query, options);
            res.send(result);
        })

        //completedSurvey

        app.post('/completed', async (req, res) => {
            const completed = req.body;
            console.log(completed);
            const result = await surveyCompletionCollection.insertOne(completed);
            res.send(result);
        });

        //payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            console.log('payment info', payment);
            res.send(paymentResult);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`survey is running on port ${port}`);
})