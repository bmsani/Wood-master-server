const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');
const port = process.env.PORT || '5000';
const app = express();
const stripe = require('stripe')(process.env.stripe_secret_key)

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
        const reviewCollection = client.db('wood_master').collection('reviews');
        const orderCollection = client.db('wood_master').collection('orders');

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

        app.post('/create-payment-intent', verifyJWT, async (req,res) => {
            const {price} = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types:['card']
            })
            res.send({clientSecret: paymentIntent.client_secret})
        });

        // passed
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

        // passed
        app.put('/singleUser/:email',verifyJWT, async (req,res) => {
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

        // passed
        app.get('/admin/:email', verifyJWT, verifyAdmin, async(req,res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })

        // passed
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) =>{
            const email = req.params.email;
            const filter = {email: email};
            const updateUser = {
                $set:{role: 'admin'},
            };
            const result = await userCollection.updateOne(filter,updateUser);
            res.send(result);
        })
    
        // passed
        app.put('/order/:id', verifyJWT, verifyAdmin, async (req, res) =>{
            const id = req.params.id;
            const status = req.body;
            const query = { _id: ObjectId(id) };
            const options = {upsert: true};
            const updateProduct = {
                $set:status,
            };
            const result = await orderCollection.updateOne(query,updateProduct,options);
            res.send(result);
        })

        app.patch('/order/:id', verifyJWT, async(req,res) => {
            const id = req.params.id;
            const payment = req.body;
            const query = { _id: ObjectId(id) };
            const updateDoc = {
                $set:{
                    paymentStatus: true,
                    transectionId: payment.transectionId
                }
            }
            const paidOrder = await orderCollection.updateOne(query,updateDoc);
            res.send(paidOrder);
        })
    
        // passed
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) =>{
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        // passed
        app.post('/order', verifyJWT, async (req, res) =>{
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })
        
        // passed
        app.put('/product/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const newQuantity= req.body;
            const query = { _id: ObjectId(id) }
            const options = {upsert : true};
            const updateQuantity = {
                $set:{
                    availableQuantity: newQuantity.availableQuantity
                },
            };
            const result = await productCollection.updateOne(query,updateQuantity,options);
            res.send(result);

        })

        // passed
        app.post('/review',verifyJWT, async (req, res) =>{
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            const review = await reviewCollection.find().toArray();
            res.send(review);
        })

        //passed
        app.get('/order', async (req, res) => {
            const order = await orderCollection.find().toArray();
            res.send(order);
        })

        // passed
        app.get('/userOrder', async (req, res) => {
            const email = req.query.email
            const query = {email: email}
            JSON.stringify(query)
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        })

        // passed
        app.delete('/product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })

        // passed
        app.delete('/order/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

        // passed
        app.get('/singleProduct/:id', verifyJWT, async (req,res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await productCollection.findOne(query);
            res.send(result)
        })

        // passed
        app.get('/order/:id', verifyJWT, async (req,res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await orderCollection.findOne(query);
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