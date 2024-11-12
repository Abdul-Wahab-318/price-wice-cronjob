const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const { getProductPage, getProductPrice , calculateChangePercentage , sortPrices , cleanPrice } = require('./utils/utils');

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri)

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

const sendEmail = async (recipient , content) =>{

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
            user: 'price.wice.info@gmail.com', // your email
            pass: 'tzim fyta mpki lczo'    // your email password or app-specific password
        }
    });

    // Email options
    const mailOptions = {
        from: 'price.wice.info@gmail.com',    // sender address
        to: recipient, // list of receivers
        subject: `Price Alert ! Check your item's latest price`,     // Subject line
        text: `Mate the price of the product you subcribed to just changed from PKR ${content.old_price} to PKR ${content.new_price} . Thats a %${content.percent_change} change.`,  // plain text body
        html: `<p>Mate the price of the product you subcribed to just changed from <strong> PKR ${content.old_price} </strong> to <strong> PKR ${content.new_price} </strong>  . Thats a <strong>  %${content.percent_change} </strong>  change.</p>` // html body
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Email sent: ' + info.response);
    });


}

const sendEmailToSubscribers = async (subscriptions , content) =>{
    for (let subscription of subscriptions) {
        
        console.log("email : " , subscription.userEmail)
        sendEmail(subscription.userEmail, content)
    }
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

                const subscriptions = await subscription_collection.find({product_id : product._id}).toArray()
                sendEmailToSubscribers(subscriptions, {new_price , old_price , percent_change})
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