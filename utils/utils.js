import axios from "axios"
import * as cheerio from "cheerio"

export const getProductPage = async (url) => {
    try{
      const response = await axios.get(url)
  
      if(response.status === 200)
        return response.data
      else
      {
        console.log("error fetching product page")
        return null
      }
    }
    catch(err){
      console.log(err)
      return null
    }
  }
  
export const cleanPrice = (price) => {
  
    price = price.replace(/[^\d.]/g, '')
  
    if(price[0] === '.')
      return  parseInt(price.slice(1).replace(/[^\d.]/g, ''))
  
    return parseInt(price.replace(/[^\d.]/g, ''))
  
  }
  
export const sortPrices = (prices) => {
  
    let filteredPrices = prices.filter(price => price > 200)
    
    if(filteredPrices.length >= 2)
      return filteredPrices.slice(0,2).sort( (a,b) => b-a)
    else
      return filteredPrices.sort( (a,b) => b-a)
  }
  
export const calculateChangePercentage = (discounted , normal) => {
  return Math.round(100 - ( discounted / normal ) * 100)
} 

export const getProductPrice = (page) =>{

  const $ = cheerio.load(page);
  $('.baadmay-gateway-wrapper').remove() // remove installment plan information
  $('body').find('script').remove() // remove stupid useless script tags that make life harder for me
  $('body').find('a').remove() // remove
  const prices = new Set()

  //if website is built with shopify the price will be inside this element
  let priceWrapper = $('.t4s-product-price')

  if(priceWrapper.length > 0){

    let priceWrapperText = priceWrapper.text()
    let priceMatched =  priceWrapperText.match(/(PKR\.?\s?[0-9.,]+|Rs\.?\s?[0-9.,]+)/)

    if(priceMatched){
      prices.add(cleanPrice(priceMatched[0]))
    }

    priceWrapper.children().each((ind , el) =>{

      const innerText = $(el).text()
      let priceMatched = innerText.match(/(PKR\.?\s?[0-9.,]+|Rs\.?\s?[0-9.,]+)/)

      if(priceMatched)
        prices.add(cleanPrice(priceMatched[0]))

    })
  }
  else{

    let body = String($('body').html())
    let pricesMatched = body.matchAll(/(PKR\.?\s?[0-9.,]+|Rs\.?\s?[0-9.,]+)/g)

    for (let el of pricesMatched){
      prices.add(cleanPrice(el[0]))
      console.log("matched : " ,el[0])
    }
  }

  let sortedPrices = sortPrices(Array.from(prices))
  console.log("sorted prices : " , sortedPrices)

  //possible discount exists
  if(sortedPrices.length >= 2){
    let normalPrice = sortedPrices[0]
    let discountedPrice = sortedPrices[1]

    return {discounted : discountedPrice , original : normalPrice}
  }
  else if( sortedPrices.length == 1 )
    return {discounted : null , original : sortedPrices[0]}
  else
    return {discounted : null , original : null}

}

