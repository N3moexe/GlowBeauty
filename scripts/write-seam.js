const fs=require("fs");const p="C:/Users/nemo/Downloads/senbonsplans/scripts/seam-map-admin-tsx.md";let c=fs.readFileSync(p,"utf8");c=c.replace("

### PART2-PLACEHOLDER
","");fs.writeFileSync(p,c,"utf8");console.log("cleaned",c.length);