const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all dynamic route files
const routeFiles = glob.sync('app/api/**/\\[*\\]/**/route.ts', { cwd: __dirname });

console.log(`Found ${routeFiles.length} dynamic route files to update`);

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Pattern to match route handler signatures with sync params
  const handlerPattern = /(export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*req:\s*NextRequest\s*,\s*{\s*params\s*}:\s*{\s*params:\s*)({[^}]+})\s*\)/g;

  // Check if file needs updating
  if (handlerPattern.test(content)) {
    console.log(`Updating: ${file}`);

    // Reset regex
    content = content.replace(
      /(export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*req:\s*NextRequest\s*,\s*{\s*params\s*}:\s*{\s*params:\s*)({[^}]+})(\s*\))/g,
      '$1Promise<$3>$4'
    );

    // Add await params at the start of each handler
    content = content.replace(
      /(export\s+async\s+function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\([^)]+\)\s*{\s*try\s*{)/g,
      match => {
        // Extract param names from the signature
        const paramMatch = match.match(/{\s*params\s*}:\s*{\s*params:\s*Promise<{\s*([^}]+)\s*}>/);
        if (paramMatch) {
          const paramNames = paramMatch[1].split(',').map(p => {
            const name = p.trim().split(':')[0].trim();
            return name;
          }).join(', ');
          return `${match}\n    const { ${paramNames} } = await params;`;
        }
        return match;
      }
    );

    // Fix params.id references to just id (for single param routes)
    if (content.includes('Promise<{ id: string }>')){
      content = content.replace(/params\.id/g, 'id');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Updated successfully`);
  } else {
    console.log(`Skipping (already updated or no handlers): ${file}`);
  }
});

console.log('\nDone!');
