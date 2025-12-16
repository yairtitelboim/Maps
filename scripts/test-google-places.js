/**
 * Test Google Places API key and geocoding functionality
 */

require('dotenv').config({ path: '../.env' });

// Test the provided API key
const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_API_KEY';

async function testGooglePlacesAPI() {
  console.log('🔍 Testing Google Places API...');
  console.log('🔑 API Key:', GOOGLE_PLACES_API_KEY.substring(0, 10) + '...');
  
  // Test 1: Search for a well-known company in Boston
  const testQuery = 'Liquid AI Cambridge Massachusetts';
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(testQuery)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    console.log(`\n🔍 Testing search for: "${testQuery}"`);
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.status === 'OK') {
      console.log('✅ Google Places API is working!');
      console.log(`📊 Found ${data.results.length} results`);
      
      if (data.results.length > 0) {
        const result = data.results[0];
        console.log('📍 First result:');
        console.log(`   Name: ${result.name}`);
        console.log(`   Address: ${result.formatted_address}`);
        console.log(`   Location: ${result.geometry.location.lat}, ${result.geometry.location.lng}`);
        console.log(`   Place ID: ${result.place_id}`);
      }
    } else {
      console.log('❌ Google Places API error:', data.status);
      console.log('Error message:', data.error_message);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
  
  // Test 2: Test geocoding for a specific address
  console.log('\n🔍 Testing geocoding for specific address...');
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent('1 Kendall Square, Cambridge, MA')}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.status === 'OK') {
      console.log('✅ Geocoding API is working!');
      if (data.results.length > 0) {
        const result = data.results[0];
        console.log('📍 Geocoded result:');
        console.log(`   Address: ${result.formatted_address}`);
        console.log(`   Location: ${result.geometry.location.lat}, ${result.geometry.location.lng}`);
      }
    } else {
      console.log('❌ Geocoding API error:', data.status);
      console.log('Error message:', data.error_message);
    }
  } catch (error) {
    console.log('❌ Geocoding error:', error.message);
  }
}

// Run the test
testGooglePlacesAPI().catch(console.error);
