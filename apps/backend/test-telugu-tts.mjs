/**
 * Test script to verify Telugu TTS is working correctly
 * Run with: node apps/backend/test-telugu-tts.mjs
 */

import { synthesizeSpeech } from './modules/google-tts.mjs';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function testTeluguTTS() {
  console.log('🧪 Testing Telugu TTS...\n');
  
  // Test with actual Telugu text
  const teluguText = 'నమస్కారం, ఇది టెస్ట్ సందేశం.';
  const outputPath = 'test-telugu-output.mp3';
  
  try {
    console.log('📝 Test Text (Telugu):', teluguText);
    console.log('📝 Test Text (English translation): "Hello, this is a test message."\n');
    
    // Clean up old test file if exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log('🗑️  Removed old test file\n');
    }
    
    console.log('🔄 Calling Google Cloud TTS...\n');
    const result = await synthesizeSpeech(teluguText, 'telugu', outputPath);
    
    console.log('\n✅ TTS completed successfully!');
    console.log('📁 Output file:', result);
    
    // Check if file exists and has content
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('📊 File size:', stats.size, 'bytes');
      
      if (stats.size > 1000) {
        console.log('✅ File size looks good (has audio content)');
      } else {
        console.log('⚠️  File size is very small - might be empty or corrupted');
      }
      
      console.log('\n🎵 To test the audio:');
      console.log(`   - Open: ${outputPath}`);
      console.log('   - Listen and verify it speaks in Telugu voice');
      console.log('   - Should NOT sound like English');
      
      return true;
    } else {
      console.log('❌ Output file was not created!');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testTeluguTTS()
  .then(success => {
    if (success) {
      console.log('\n✅ Test completed - Check the audio file to verify Telugu voice');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed - Check errors above');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

