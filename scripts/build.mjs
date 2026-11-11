// Rebuilds this repository from remotelyaijobs.com's public data files. No dependencies.
// Writes companies.csv, reports/<slug>/{facts.json,*.csv}, README.md. Prints NEW_REPORTS=<slugs>.
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const SITE = "https://remotelyaijobs.com";
const get = async (p) => {
  const r = await fetch(`${SITE}${p}`, { headers: { "User-Agent": "remotely-ai-dataset-bot" } });
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
};
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";

const { updated, companies } = await get("/data/companies.json");
const { reports } = await get("/data/reports.json");

await writeFile("companies.csv", toCsv(companies, ["company", "openRoles", "remote", "hybrid", "mainCategory", "url"]));

const existing = existsSync("reports") ? await readdir("reports") : [];
const fresh = [];
for (const rep of reports) {
  if (!rep.facts) continue;
  const dir = `reports/${rep.slug}`;
  if (!existing.includes(rep.slug)) fresh.push(rep.slug);
  await mkdir(dir, { recursive: true });
  const f = rep.facts;
  await writeFile(`${dir}/facts.json`, JSON.stringify(f, null, 2) + "\n");
  await writeFile(`${dir}/new-roles-by-category.csv`, toCsv(f.flow.newByCategory, ["label", "roles", "share", "companies"]));
  await writeFile(`${dir}/new-roles-by-country.csv`, toCsv(f.flow.newByCountry, ["label", "roles", "share", "companies"]));
  await writeFile(`${dir}/top-hiring-companies.csv`, toCsv(f.flow.topCompaniesByNewRoles, ["company", "newRoles"]));
  await writeFile(`${dir}/skills.csv`, toCsv(f.skills.momentum, ["skill", "roles", "companies", "shareOfNewRoles", "previousShare", "pointChange"]));
  if (f.categoryChange) await writeFile(`${dir}/category-change.csv`, toCsv(f.categoryChange, ["category", "newRoles", "previousNewRoles", "changePct"]));
  await writeFile(
    `${dir}/README.md`,
    `# ${rep.title}\n\nPeriod: ${rep.period.start} to ${rep.period.end}. Published ${rep.published}.\n\n${rep.description}\n\nFull report: ${rep.url}\n\nFiles: \`facts.json\` (everything), plus CSVs for each table.\n`
  );
}

const total = companies.reduce((n, c) => n + c.openRoles, 0);
const table = companies
  .map((c) => `| [${c.company.replace(/\|/g, "/")}](${c.url}) | ${c.openRoles} | ${c.remote} | ${c.hybrid} | ${c.mainCategory} |`)
  .join("\n");
const reportList = reports.map((r) => `- [${r.title}](${r.url}) · data: [reports/${r.slug}](reports/${r.slug})`).join("\n");

await writeFile(
  "README.md",
  `# AI companies hiring in Europe, and European AI hiring data

A free, weekly-updated list of companies with open remote and hybrid AI roles in Europe, plus the
data behind the [Remotely AI](${SITE}/) hiring reports. Updated ${updated}.

Roles are read every weekday from employers' own career sites (Ashby, Greenhouse, Lever, Workday and
others) and removed within days of closing. Main board only: internships and graduate roles are
counted separately on the site.

## AI companies hiring in Europe right now

${companies.length} companies, ${total} open roles. Employers are capped at 40 listed roles, so the
largest hirers show 40.

| Company | Open roles | Remote | Hybrid | Most roles in |
| --- | ---: | ---: | ---: | --- |
${table}

Download: [companies.csv](companies.csv)

## Hiring data reports

${reportList || "None yet."}

Each report folder holds the full facts pack (\`facts.json\`) and a CSV per table: new roles by
category and country, top hiring companies, skills gaining or losing share.

## Use and citation

Data is CC BY 4.0. Use it for anything; credit "Remotely AI (remotelyaijobs.com)" with a link.
Each release is archived with a DOI on Zenodo (see the badge or the Releases page).

Live roles: [remotelyaijobs.com](${SITE}/)
`
);

console.log(`NEW_REPORTS=${fresh.join(" ")}`);
