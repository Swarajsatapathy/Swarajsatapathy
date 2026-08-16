import fs from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "Swarajsatapathy";
const token = process.env.GH_TOKEN;

if (!token) {
  throw new Error("GH_TOKEN is missing.");
}

const now = new Date();
const oneYearAgo = new Date(now);

oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

const query = `
  query UserActivity(
    $login: String!
    $from: DateTime!
    $to: DateTime!
  ) {
    user(login: $login) {

      repositories(
        first: 100
        ownerAffiliations: OWNER
        privacy: PUBLIC
      ) {
        totalCount

        nodes {
          stargazerCount
        }
      }

      contributionsCollection(
        from: $from
        to: $to
      ) {
        totalCommitContributions

        contributionCalendar {
          totalContributions

          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",

  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "github-profile-activity",
  },

  body: JSON.stringify({
    query,

    variables: {
      login: username,
      from: oneYearAgo.toISOString(),
      to: now.toISOString(),
    },
  }),
});

if (!response.ok) {
  throw new Error(
    `GitHub GraphQL request failed: ${response.status}`
  );
}

const json = await response.json();

if (json.errors) {
  throw new Error(
    JSON.stringify(json.errors, null, 2)
  );
}

const user = json.data.user;

if (!user) {
  throw new Error(`GitHub user "${username}" was not found.`);
}

/* -------------------------------------------------- */
/* GitHub stats                                       */
/* -------------------------------------------------- */

const repositories = user.repositories.nodes ?? [];

const totalStars = repositories.reduce(
  (total, repo) => total + repo.stargazerCount,
  0
);

const repositoryCount =
  user.repositories.totalCount;

const totalCommits =
  user.contributionsCollection.totalCommitContributions;

const calendar =
  user.contributionsCollection.contributionCalendar;

const totalContributions =
  calendar.totalContributions;

/* -------------------------------------------------- */
/* Streak calculations                                */
/* -------------------------------------------------- */

const contributionDays =
  calendar.weeks
    .flatMap((week) => week.contributionDays)
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    );

function calculateStreaks(days) {
  let longest = 0;
  let running = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let index = days.length - 1;

  const today =
    new Date().toISOString().slice(0, 10);

  /*
   * Don't destroy the current streak simply because
   * today's contribution count is still zero.
   */
  if (
    days[index]?.date === today &&
    days[index]?.contributionCount === 0
  ) {
    index -= 1;
  }

  let current = 0;

  while (
    index >= 0 &&
    days[index].contributionCount > 0
  ) {
    current += 1;
    index -= 1;
  }

  return {
    current,
    longest,
  };
}

const {
  current: currentStreak,
  longest: longestStreak,
} = calculateStreaks(contributionDays);

/* -------------------------------------------------- */
/* SVG                                                */
/* -------------------------------------------------- */

function makeCard(title, metrics) {
  const width = 520;
  const height = 118;

  const positions = [
    100,
    260,
    420,
  ];

  const metricSvg = metrics
    .map((metric, index) => {
      const x = positions[index];

      return `
        <g transform="translate(${x}, 0)">

          <text
            x="0"
            y="53"
            text-anchor="middle"
            class="icon"
          >
            ${metric.icon}
          </text>

          <text
            x="0"
            y="76"
            text-anchor="middle"
            class="value"
          >
            ${metric.value}
          </text>

          <text
            x="0"
            y="95"
            text-anchor="middle"
            class="label"
          >
            ${metric.label}
          </text>

        </g>
      `;
    })
    .join("");

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

  <style>

    .title {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;

      font-size: 14px;
      font-weight: 700;
      fill: #ffffff;
    }

    .icon {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;

      font-size: 14px;
      fill: #ffffff;
    }

    .value {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;

      font-size: 18px;
      font-weight: 700;
      fill: #ffffff;
    }

    .label {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;

      font-size: 10px;
      fill: #8b949e;
    }

  </style>

  <rect
    width="520"
    height="118"
    rx="3"
    fill="#000000"
  />

  <text
    x="18"
    y="25"
    class="title"
  >
    ${title}
  </text>

  ${metricSvg}

</svg>
`;
}

/* -------------------------------------------------- */
/* Card 1                                             */
/* -------------------------------------------------- */

const streakCard = makeCard(
  "Streak &amp; Contributions",
  [
    {
      icon: "●",
      value: currentStreak,
      label: "Current Streak",
    },
    {
      icon: "◆",
      value: longestStreak,
      label: "Longest Streak",
    },
    {
      icon: "⌁",
      value: totalContributions,
      label: "Contributions",
    },
  ]
);

/* -------------------------------------------------- */
/* Card 2                                             */
/* -------------------------------------------------- */

const githubCard = makeCard(
  "GitHub Stats",
  [
    {
      icon: "★",
      value: totalStars,
      label: "Stars",
    },
    {
      icon: "⌁",
      value: totalCommits,
      label: "Commits",
    },
    {
      icon: "▣",
      value: repositoryCount,
      label: "Repositories",
    },
  ]
);

/* -------------------------------------------------- */
/* Write files                                        */
/* -------------------------------------------------- */

await fs.mkdir("assets", {
  recursive: true,
});

await fs.writeFile(
  "assets/activity-streak.svg",
  streakCard,
  "utf8"
);

await fs.writeFile(
  "assets/activity-github.svg",
  githubCard,
  "utf8"
);

console.log("Activity cards generated.");

console.log({
  currentStreak,
  longestStreak,
  totalContributions,
  totalStars,
  totalCommits,
  repositoryCount,
});