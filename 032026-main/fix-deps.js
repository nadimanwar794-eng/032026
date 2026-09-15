const fs = require('fs');

const replacements = {
  '@replit/vite-plugin-cartographer': '^0.5.21',
  '@replit/vite-plugin-dev-banner': '^0.1.1',
  '@replit/vite-plugin-runtime-error-modal': '^0.0.6',
  '@tailwindcss/vite': '^4.1.14',
  '@types/node': '^25.3.3',
  '@types/react': '^19.2.0',
  '@types/react-dom': '^19.2.0',
  '@vitejs/plugin-react': '^5.0.4',
  'class-variance-authority': '^0.7.1',
  'clsx': '^2.1.1',
  'drizzle-orm': '^0.45.2',
  'framer-motion': '^12.23.24',
  'lucide-react': '^0.545.0',
  'react': '19.1.0',
  'react-dom': '19.1.0',
  'tailwind-merge': '^3.3.1',
  'tailwindcss': '^4.1.14',
  'tsx': '^4.21.0',
  'vite': '^7.3.2',
  'zod': '^3.25.76',
  '@tanstack/react-query': '^5.90.21'
};

const { execSync } = require('child_process');

const files = execSync('find . -name "package.json" -not -path "*/node_modules/*"').toString().trim().split('\n');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let parsed = JSON.parse(content);
  let changed = false;
  
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (parsed[field]) {
      for (const [pkg, version] of Object.entries(parsed[field])) {
        if (version === '^0.5.21' || version === 'catalog:') {
          if (replacements[pkg]) {
            parsed[field][pkg] = replacements[pkg];
            changed = true;
          }
        }
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n');
  }
}
