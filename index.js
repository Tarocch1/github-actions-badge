const https = require('https');

const getCheckSuites = (owner, repo, branch) => new Promise((resolve, reject) => {
  const req = {
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${owner}/${repo}/commits/${branch}/check-suites`,
    headers: {
      'Accept': 'application/vnd.github.antiope-preview+json',
      'User-Agent': 'node',
    },
  };
  https.get(req, resp => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('error', error => reject(error));
    resp.on('end', () => {
      const parsed = JSON.parse(data);
      if (resp.statusCode === 200) {
        resolve(parsed.check_suites);
      } else {
        reject(parsed);
      }
    });
  });
});

const getBadge = (status, color, style) => new Promise((resolve, reject) => {
  const req = {
    hostname: 'img.shields.io',
    port: '443',
    path: `/badge/Github_Actions-${status}-${color}.svg?logo=github&style=${style}`,
  };
  https.get(req, resp => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('error', error => reject(error));
    resp.on('end', () => resolve(data));
  });
});

module.exports.handler = async function(request, response, context) {
  response.setHeader('Cache-Control', 'max-age=30');
  try {
    const { path, queries } = request;
    const style = queries.style || 'flat';
    const pathArray = path.replace(/\/$/, '').split('/');
    if (pathArray.length < 4) {
      response.setHeader('Content-Type', 'text/plain');
      response.send('Path error!');
    } else {
      const owner = pathArray[2];
      const repo = pathArray[3];
      const branch = pathArray[4] || 'master';
      let suites = await getCheckSuites(owner, repo, branch);
      suites = suites.filter(checkSuite => checkSuite.app.name === 'GitHub Actions');
      let status = 'unknown';
      let color = 'lightgrey';
      if (suites.length > 0) {
        if (suites[0].status !== 'completed') {
          status = 'pending';
          color = 'yellow';
        } else {
          status = suites[0].conclusion === 'success' ? 'passing' : 'failed';
          color = suites[0].conclusion === 'success' ? 'brightgreen' : 'red';
        }
      }
      const badge = await getBadge(status, color, style);
      response.setHeader('Content-Type', 'image/svg+xml');
      response.send(badge);
    }
  } catch(error) {
    response.setHeader('Content-Type', 'text/plain');
    response.send(JSON.stringify(error));
  }
};
