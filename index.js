const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || '5000';
const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.urnhu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const userCollection = client.db('wood_master').collection('users');

        app.put('/user/:email', async (req,res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = {upsert : true};
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter,updateDoc,options);
            const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN, {expiresIn: '1d'})
            res.send({result,token});
        })
    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from WoodMaster')
})

app.listen(port, () => {
    console.log(`Wood-master is listening to port: ${port}`);
})