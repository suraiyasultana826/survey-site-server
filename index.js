const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
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

        app.get('/surveys', async (req, res) => {
            const cursor = surveyCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })


        //user related api
        app.post('/users', async(req, res) => {
            const user = req.body;
            const query = {email: user.email}
            const existingUser = await userCollection.findOne(query);
            if(existingUser){
                return res.send({message: 'user already exists', insertedId: null})
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        //created survey

        app.post('/surveys', async(req, res) => {
            const created = req.body;
            console.log(created);
            const result = await surveyCollection.insertOne(created);
            res.send(result);
        })

        app.get('/surveys/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {

                projection: { image:1, category:1, voted:1, description:1, questionOne:1, questionTwo:1, questionThree:1, title: 1, imdb: 1 },
            };
            const result = await surveyCollection.findOne(query, options);
            res.send(result);
        })

        //completedSurvey

        app.post('/completed', async(req, res) => {
            const completed = req.body;
            console.log(completed);
            const result = await surveyCompletionCollection.insertOne(completed);
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