const axios = require('axios');

async function checkProjects() {
  try {
    const response = await axios.get('http://localhost:3000/api/projects');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching projects:', error.message);
  }
}

checkProjects();
