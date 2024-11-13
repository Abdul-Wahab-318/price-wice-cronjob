require('dotenv').config()
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const { getProductPage, getProductPrice , calculateChangePercentage , sortPrices , cleanPrice } = require('./utils/utils');

console.log("URI : " , process.env.MONGODB_URI)
const client = new MongoClient(process.env.MONGODB_URI)

const getDB = async () =>{
    try{
        await client.connect()
        return client.db('pricewice')
    }
    catch(err){
        console.error(err)
        return null
    }
}

const scrapeLatestPrice = async (product) =>{
    try{
        const product_page = await getProductPage(product.url)
        const product_price = getProductPrice(product_page)
    
        return product_price
    }
    catch(err){
        console.log("error scraping latest price : " , err)
        return null
    }
}

const didPriceChange = (latest_price , old_price) =>{

    if (latest_price['discounted'] === null && latest_price['original'] === null){
        throw new Error('Error scraping product price')
    }
    else if(latest_price['discounted'])
        return (latest_price['discounted'] !== old_price)
    
    else
        return (latest_price['original'] !== old_price)
    

}

const sendEmailToSubscribers = async (subscriptions , content) =>{

    let subscribers = subscriptions.map(subscription => subscription.userEmail).join(",")

    // Create a transporter with your email provider settings
    const transporter = nodemailer.createTransport({
        service: 'gmail', // use your email service like Gmail, Outlook, etc.
        port : 465,
        secure: true,
        secureConnection : false,
        tls:{
            rejectUnauthorized : true
        },
        auth: {
            user: process.env.EMAIL_ADDRESS, // your email
            pass: process.env.EMAIL_PASS   // your email password or app-specific password
        }
    });
    
    // Email options
    const mailOptions = {
        from: 'price.wice.info@gmail.com',    // sender address
        to: subscribers, // list of receivers
        subject: 'Price Update on Your Subscribed Product',
        text: `Hi there,
    
            The price of the product you subscribed to, "${content.url}," has recently changed. 
            
            Previous Price: PKR ${content.old_price}
            Current Price: PKR ${content.new_price}
            Price Change: ${content.percent_change > 0 ? 'Decreased' : 'Increased'} by ${Math.abs(content.percent_change)}%
            
            Thank you for subscribing to Price-Wice alerts. We’re here to keep you updated on the latest price changes for your favorite products.
            
            Best regards,  
            The Price-Wice Team
            
            If you no longer wish to receive these alerts, you can unsubscribe`,
        
        html: `<p>Hi there,</p>
                <p>The price of the product you subscribed to, "<strong>${content.url}</strong>," has recently changed.</p>
                <ul>
                    <li><strong>Previous Price:</strong> PKR ${content.old_price}</li>
                    <li><strong>Current Price:</strong> PKR ${content.new_price}</li>
                    <li><strong>Price Change:</strong> ${content.percent_change > 0 ? 'Decreased' : 'Increased'} by ${Math.abs(content.percent_change)}%</li>
                </ul>
                <p>Thank you for subscribing to Price-Wice alerts. We’re here to keep you updated on the latest price changes for your favorite products.</p>
                <p>Best regards,<br>
                The Price-Wice Team</p>
                <p style="font-size: 12px;">If you no longer wish to receive these alerts, you can unsubscribe </p>`
    
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Email sent: ' + info.response);
    });
    
}


const checkProductPrices = async () =>{
    try{
        const db = await getDB()
        const product_collection = db.collection('products')
        const price_collection = db.collection('productprices')
        const subscription_collection = db.collection('subscriptions')
        const products = await product_collection.find().toArray()
        
        for (let product of products){

            const product_price_doc = await price_collection.findOne(
                {product_id : product._id} ,
                {sort : {createdAt : -1}} //get latest
            )
            const old_price = product_price_doc.price
            const latest_price = await scrapeLatestPrice(product)
            console.log("old : " , old_price , " new : " , latest_price )
            const price_changed = didPriceChange(latest_price , old_price)

            if(price_changed){
                const new_price = latest_price['discounted'] ? latest_price['discounted'] : latest_price['original']
                const percent_change = calculateChangePercentage(new_price, old_price)

                const new_price_doc = await price_collection.insertOne({
                    price : new_price,
                    product_id : product._id,
                    createdAt : new Date(),
                    updatedAt : new Date()
                })
                const subscriptions = await subscription_collection.find({product_id : product._id}).toArray()
                sendEmailToSubscribers(subscriptions, {new_price , old_price , percent_change , url : product.url})
                console.log("price changed from " , old_price , " to " , new_price)
            }
            else{
                console.log("Product price did not change")
            }
        }
    }
    catch(err){
        console.error(err)
    }

}

checkProductPrices()