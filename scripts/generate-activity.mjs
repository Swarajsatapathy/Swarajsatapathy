import fs from "node:fs/promises";

const username =
  process.env.GITHUB_USERNAME || "Swarajsatapathy";

const token = process.env.GH_TOKEN;

if (!token) {
  throw new Error("GH_TOKEN is missing.");
}

const now = new Date();
const oneYearAgo = new Date(now);

oneYearAgo.setUTCFullYear(
  oneYearAgo.getUTCFullYear() - 1
);

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

const response = await fetch(
  "https://api.github.com/graphql",
  {
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
  }
);

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
  throw new Error(
    `GitHub user "${username}" was not found.`
  );
}

/* -------------------------------------------------- */
/* GitHub stats                                       */
/* -------------------------------------------------- */

const repositories =
  user.repositories.nodes ?? [];

const totalStars = repositories.reduce(
  (total, repo) =>
    total + repo.stargazerCount,
  0
);

const repositoryCount =
  user.repositories.totalCount;

const totalCommits =
  user.contributionsCollection
    .totalCommitContributions;

const calendar =
  user.contributionsCollection
    .contributionCalendar;

const totalContributions =
  calendar.totalContributions;

/* -------------------------------------------------- */
/* Streak calculations                                */
/* -------------------------------------------------- */

const contributionDays =
  calendar.weeks
    .flatMap(
      (week) => week.contributionDays
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    );

function calculateStreaks(days) {
  let longest = 0;
  let running = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      running += 1;

      longest = Math.max(
        longest,
        running
      );
    } else {
      running = 0;
    }
  }

  let index = days.length - 1;

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  /*
   * Don't kill the streak simply because
   * today's contribution is still zero.
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
} = calculateStreaks(
  contributionDays
);

/* -------------------------------------------------- */
/* Combined dashboard SVG                             */
/* -------------------------------------------------- */

function makeOverviewCard() {
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1080"
  height="130"
  viewBox="0 0 1080 130"
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

      font-size: 15px;
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

      font-size: 20px;
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

  <!-- LEFT -->
  <rect
    x="0"
    y="0"
    width="530"
    height="125"
    rx="2"
    fill="#000000"
  />

  <text
    x="20"
    y="27"
    class="title"
  >
    Streak &amp; Contributions
  </text>

  <g transform="translate(105,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ●
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${currentStreak}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Current Streak
    </text>
  </g>

  <g transform="translate(265,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ◆
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${longestStreak}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Longest Streak
    </text>
  </g>

  <g transform="translate(425,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ⌁
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${totalContributions}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Contributions
    </text>
  </g>

  <!-- RIGHT -->
  <rect
    x="550"
    y="0"
    width="530"
    height="125"
    rx="2"
    fill="#000000"
  />

  <text
    x="570"
    y="27"
    class="title"
  >
    GitHub Stats
  </text>

  <g transform="translate(655,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ★
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${totalStars}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Stars
    </text>
  </g>

  <g transform="translate(815,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ⌁
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${totalCommits}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Commits
    </text>
  </g>

  <g transform="translate(975,0)">
    <text
      x="0"
      y="57"
      text-anchor="middle"
      class="icon"
    >
      ▣
    </text>

    <text
      x="0"
      y="81"
      text-anchor="middle"
      class="value"
    >
      ${repositoryCount}
    </text>

    <text
      x="0"
      y="103"
      text-anchor="middle"
      class="label"
    >
      Repositories
    </text>
  </g>

</svg>
`;
}

const overviewCard =
  makeOverviewCard();

/* -------------------------------------------------- */
/* Write output                                       */
/* -------------------------------------------------- */

await fs.mkdir(
  "assets",
  {
    recursive: true,
  }
);

await fs.writeFile(
  "assets/activity-overview.svg",
  overviewCard,
  "utf8"
);

console.log(
  "Activity overview generated."
);

console.log({
  currentStreak,
  longestStreak,
  totalContributions,
  totalStars,
  totalCommits,
  repositoryCount,
});