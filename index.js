const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');
const port = process.env.PORT || '5000';
const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.urnhu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'Unauthorized access'})
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden Access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const userCollection = client.db('wood_master').collection('users');
        const productCollection = client.db('wood_master').collection('products');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterData = await userCollection.findOne({email: requester});
            if(requesterData.role === 'admin'){
                next();
            }
            else{
                res.status(403).send({message: 'forbidden'}); 
            }
        }

        app.get('/user', verifyJWT,  async (req,res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })

        app.get('/singleUser', async (req,res) => {
            const email = req.query.email;
            const query = {email: email}
            const user = await userCollection.find(query).toArray()
            res.send(user);
        })

        app.get('/product', async (req, res) => {
            const products = await productCollection.find().toArray();
            res.send(products);
        })

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
        });

        app.put('/singleUser/:email', async (req,res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = {upsert : true};
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter,updateDoc,options);
            res.send(result);
        });

        app.get('/admin/:email', async(req,res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) =>{
            const email = req.params.email;
            const filter = {email: email};
            const updateUser = {
                $set:{role: 'admin'},
            };
            const result = await userCollection.updateOne(filter,updateUser);
            res.send(result);
        })
    
        app.post('/product', async (req, res) =>{
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/singleProduct/:id', async (req,res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await productCollection.findOne(query);
            res.send(result)
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