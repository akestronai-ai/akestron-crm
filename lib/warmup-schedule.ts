export interface PlatformDailyTasks {
  platform: "facebook" | "instagram";
  dayTitle: string;
  summary: string;
  metrics: {
    label: string;
    target: string;
    description: string;
    highlight?: boolean;
    warning?: boolean;
  }[];
  criticalRules: string[];
  musaProTip: string;
}

export interface DaySchedule {
  dayNumber: number;
  phase: string;
  facebook: PlatformDailyTasks;
  instagram: PlatformDailyTasks;
}

export function getDailySchedule(day: number): DaySchedule {
  if (day <= 1) {
    return {
      dayNumber: 1,
      phase: "Phase 1: Pure Algorithmic Warm-Up",
      facebook: {
        platform: "facebook",
        dayTitle: "Facebook Day 1 — Natural Human Browsing",
        summary: "Do NOT send friend requests or direct messages today. Mimic real user activity to initiate account trust.",
        metrics: [
          { label: "Posts to Interact With", target: "5 posts", description: "Scroll feed and relevant industry groups" },
          { label: "Likes to Give", target: "10 likes", description: "Genuine reactions on posts" },
          { label: "Comments to Leave", target: "5 comments", description: "Meaningful, human comments (no spam/links)" },
          { label: "Friend Requests", target: "0 requests", description: "STRICTLY 0 today to avoid bot flags", highlight: true, warning: true },
          { label: "Pages to Follow", target: "0 pages", description: "Keep account baseline normal" },
        ],
        criticalRules: [
          "Do NOT pitch anyone today.",
          "Do NOT send any friend requests.",
          "Ensure your personal profile is linked to your professional Facebook page (Module 4 setup).",
        ],
        musaProTip: "Facebook uses an algorithm to detect spam. It hates repetition and speed. Fly completely under the radar on Day 1.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: "Instagram Day 1 — Activity Baseline & Story Post",
        summary: "Start establishing creator authority with native content while training your niche algorithm.",
        metrics: [
          { label: "Posts to Interact With", target: "1 post", description: "Explore niche content (e.g., HVAC, remodeling)" },
          { label: "Likes to Give", target: "10 likes", description: "Authentic likes on niche posts & memes" },
          { label: "Comments to Leave", target: "5 comments", description: "Leave authentic remarks" },
          { label: "Follow Requests", target: "0 follows", description: "Zero outbound follows on Day 1", highlight: true, warning: true },
          { label: "Stories to Post", target: "1 to 2 stories", description: "Post behind-the-scenes or offer context" },
          { label: "Cold DMs", target: "0 DMs (Blocked)", description: "Never cold message on Day 1", warning: true },
        ],
        criticalRules: [
          "STRICTLY ZERO cold DMs. Direct messaging today leads directly to 'Hidden Requests' or shadowban.",
          "Only interact with posts in your exact niche to train the Explore feed algorithm.",
        ],
        musaProTip: "Use Day 1 to condition Instagram's algorithm. Like and view only your target market so your Explore tab starts feeding you prospects.",
      },
    };
  }

  if (day === 2) {
    return {
      dayNumber: 2,
      phase: "Phase 1: First Outbound Touchpoints",
      facebook: {
        platform: "facebook",
        dayTitle: "Facebook Day 2 — Gentle Outbound & Content",
        summary: "Initiate your first 2 connection requests and post native content to your profile.",
        metrics: [
          { label: "Posts to Interact With", target: "5 posts", description: "Browse group discussions" },
          { label: "Likes to Give", target: "10 likes", description: "Distribute across industry posts" },
          { label: "Comments to Leave", target: "5 comments", description: "Thoughtful responses in niche groups" },
          { label: "Friend Requests", target: "2 Friend Requests", description: "Target verified business owners only", highlight: true },
          { label: "Pages to Follow", target: "Follow 2 pages", description: "Follow relevant business/industry pages" },
          { label: "Profile Content", target: "1-2 Posts or Story", description: "Showcase business expertise / value" },
        ],
        criticalRules: [
          "Send ONLY 2 friend requests today.",
          "Never message a prospect without sending a friend request first.",
          "Start logging prospects for tomorrow's Two-Day workflow.",
        ],
        musaProTip: "If you message without friend requests, Facebook marks your account as a 'RED LIGHT' and tosses messages into spam.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: "Instagram Day 2 — First Follows & Media Upload",
        summary: "Publish a high-value feed post or story and begin very low-volume following.",
        metrics: [
          { label: "Likes to Give", target: "10 likes", description: "Like target business posts" },
          { label: "Comments to Leave", target: "5 comments", description: "Engage with potential prospects" },
          { label: "Follow Requests", target: "2 Follow Requests", description: "Follow 2 verified owner profiles", highlight: true },
          { label: "Content Upload", target: "1 Story or Reel/Carousel", description: "Educational or positioning asset" },
          { label: "Cold DMs", target: "0 DMs (Still Blocked)", description: "Outreach unlocks on Day 6", warning: true },
        ],
        criticalRules: [
          "Do not pitch yet. Account trust is still fragile.",
          "Never pitch to business pages. Always look for the owner's personal profile tagged in posts.",
        ],
        musaProTip: "Reverse engineer competitor followings (like digital marketing agencies) to find active business owners.",
      },
    };
  }

  if (day === 3) {
    return {
      dayNumber: 3,
      phase: "Phase 1: Stepping Up Volume",
      facebook: {
        platform: "facebook",
        dayTitle: "Facebook Day 3 — Increasing Interaction Pace",
        summary: "Double engagement and step up to 4 friend requests while following authority pages.",
        metrics: [
          { label: "Posts to Interact With", target: "10 posts", description: "Deep dive into targeted niche groups" },
          { label: "Likes to Give", target: "15 likes", description: "Likes on posts and comments" },
          { label: "Comments to Leave", target: "10 comments", description: "Add value to group discussions" },
          { label: "Friend Requests", target: "4 Friend Requests", description: "Pre-vetted Platinum prospects", highlight: true },
          { label: "Pages to Follow", target: "Follow 5 pages", description: "Competitor & authority brand pages" },
        ],
        criticalRules: [
          "Cap friend requests at exactly 4 today.",
          "Check yesterday's 2 friend requests. If accepted, queue them for Day 1 outreach.",
        ],
        musaProTip: "Platinum prospects are those who explicitly advertise their services. Prioritize these over passive bronze profiles.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: "Instagram Day 3 — Consistency & Authority",
        summary: "Expand engagement volume and publish your third consecutive piece of media.",
        metrics: [
          { label: "Posts to Interact With", target: "10 posts", description: "Interact with hashtag search results" },
          { label: "Likes to Give", target: "15 likes", description: "Engage across 15 different posts" },
          { label: "Comments to Leave", target: "10 comments", description: "Comments on owners' content" },
          { label: "Follow Requests", target: "4 Follow Requests", description: "Follow 4 business owners", highlight: true },
          { label: "Content Upload", target: "Story or Reel/Carousel", description: "Keep daily posting streak unbroken" },
          { label: "Cold DMs", target: "0 DMs (Still Blocked)", description: "3 days left until outreach starts", warning: true },
        ],
        criticalRules: [
          "Maintain daily content cadence. Inactive accounts get lower DM deliverability.",
          "Check meme pages related to your niche (e.g. kitchen remodeling memes) and inspect commenter profiles.",
        ],
        musaProTip: "Niche memes are goldmines. Real owners vent and comment on industry memes while agencies ignore them.",
      },
    };
  }

  if (day === 4) {
    return {
      dayNumber: 4,
      phase: "Phase 1: Human Emulation & Mini Games",
      facebook: {
        platform: "facebook",
        dayTitle: "Facebook Day 4 — Peak Warmup & The Mini-Game Tactic",
        summary: "Step up to 6 friend requests and spend 5-10 minutes on casual platform features (mini games).",
        metrics: [
          { label: "Posts to Interact With", target: "20 posts", description: "Comprehensive group browsing" },
          { label: "Likes to Give", target: "30 likes", description: "Broad social activity" },
          { label: "Comments to Leave", target: "20 comments", description: "High natural interaction" },
          { label: "Friend Requests", target: "6 Friend Requests", description: "Cap at 6 requests today", highlight: true },
          { label: "Pages to Follow", target: "Follow 8 pages", description: "Follow niche leaders & tools" },
          { label: "Casual Activity", target: "5 to 10 Mins Mini Games", description: "Musa's trick to prove human behavior", highlight: true },
        ],
        criticalRules: [
          "Play Facebook mini-games or watch Reels for 5-10 minutes. Bots never play games.",
          "Cap friend requests at 6 today.",
        ],
        musaProTip: "Playing mini games for 5-10 minutes confuses Facebook's bot-detection heuristic and cements account authenticity.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: "Instagram Day 4 — Final Pre-Outreach Ramp",
        summary: "Scale to 10 follow requests and prepare your account for outreach launching on Day 6.",
        metrics: [
          { label: "Posts to Interact With", target: "20 posts", description: "Engage with potential client accounts" },
          { label: "Likes to Give", target: "30 likes", description: "Broad profile engagement" },
          { label: "Comments to Leave", target: "20 comments", description: "Meaningful engagement" },
          { label: "Follow Requests", target: "10 Follow Requests", description: "Follow 10 targeted prospects", highlight: true },
          { label: "Content Upload", target: "Story or Reel/Photo/Carousel", description: "Positioning content" },
          { label: "Cold DMs", target: "0 DMs (Final warmup day)", description: "Tomorrow is prep, Day 6 outreach goes live", warning: true },
        ],
        criticalRules: [
          "Do NOT rush DMs today. You are 48 hours away from full outreach safety.",
          "Inspect who followed you back from Days 2 & 3. Note them for Day 6.",
        ],
        musaProTip: "Your account is nearly warmed. Notice how your Explore page is now populated with niche businesses.",
      },
    };
  }

  if (day === 5) {
    return {
      dayNumber: 5,
      phase: "Phase 2: Transition & Setup",
      facebook: {
        platform: "facebook",
        dayTitle: "Facebook Day 5 — Two-Day Workflow Activation",
        summary: "Enter the standard Two-Day Workflow: Pitch previously accepted friends and send 8 new requests.",
        metrics: [
          { label: "Friend Requests", target: "8 Friend Requests", description: "Send to new targeted prospects", highlight: true },
          { label: "Interactions", target: "20 posts / 30 likes / 20 comments", description: "Keep baseline human activity high" },
          { label: "Pitch Accepted Friends", target: "All Accepted Friends", description: "Direct message with green light", highlight: true },
          { label: "Content", target: "1 Story or Post", description: "Maintain active personal timeline" },
        ],
        criticalRules: [
          "Check your friends list: ONLY message those who accepted your request.",
          "Do not pitch cold unfriended users.",
        ],
        musaProTip: "Once accepted, you have the GREEN LIGHT to message. Deliverability to Messenger is 100%.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: "Instagram Day 5 — Eve of Outreach Launch",
        summary: "Scale to 15 follows. Review follow-backs and prepare direct messages for tomorrow.",
        metrics: [
          { label: "Follow Requests", target: "15 Follow Requests", description: "Target active business owners", highlight: true },
          { label: "Engagement", target: "20 posts / 30 likes / 20 comments", description: "Interact before following" },
          { label: "Content", target: "Post Story + Reel", description: "High-visibility content" },
          { label: "Cold DMs", target: "Zero Today (Starts Tomorrow)", description: "DMs officially launch on Day 6", warning: true },
        ],
        criticalRules: [
          "Final day of zero messaging.",
          "Compile your list of people who followed you back over the past 4 days.",
        ],
        musaProTip: "Follow-backs are high-intent leads. They saw your profile, found it relevant, and opted in. Tomorrow you message them.",
      },
    };
  }

  if (day <= 14) {
    const fbReq = Math.min(20, 8 + (day - 5) * 2);
    return {
      dayNumber: day,
      phase: "Phase 2: Active Outreach & Ramp-Up",
      facebook: {
        platform: "facebook",
        dayTitle: `Facebook Day ${day} — Two-Day Outreach Cadence`,
        summary: `Ramp up to ${fbReq} friend requests and continuously pitch yesterday's accepted connections.`,
        metrics: [
          { label: "Friend Requests", target: `${fbReq} Friend Requests`, description: `Safe Day ${day} limit`, highlight: true },
          { label: "Pitch Accepted Friends", target: "Daily Batch Pitch", description: "Message friends accepted in last 24-48h", highlight: true },
          { label: "Interactions", target: "20 posts / 25 likes / 15 comments", description: "Maintain natural engagement" },
          { label: "Pages / Groups", target: "Follow 5-10 pages / groups", description: "Keep joining localized niche groups" },
        ],
        criticalRules: [
          "Batch workflow: Source & request today -> Pitch tomorrow once accepted.",
          "Do not skip daily interactions; an account that only adds friends gets flagged.",
        ],
        musaProTip: "Never pitch immediately upon acceptance. Give it a few hours or the next day so it feels natural.",
      },
      instagram: {
        platform: "instagram",
        dayTitle: `Instagram Day ${day} — Active Direct Outreach`,
        summary: "Apply Musa Khan's two outreach rules: Follow-back messaging and non-follower post engagement.",
        metrics: [
          { label: "Follow-Back DMs", target: "Message Next Day", description: "Musa Rule: Message everyone who followed back", highlight: true },
          { label: "Non-Follower DMs", target: "Comment on Post First", description: "Interact with their post before sending DM" },
          { label: "New Follows Sent", target: "20-25 Follows / day", description: "Gradual expansion pace", highlight: true },
          { label: "Daily Content", target: "1 Story daily + 2 Reels/week", description: "Keep profile active for prospects visiting" },
        ],
        criticalRules: [
          "Rule 1: If someone follows back, send them a personalized message the next day.",
          "Rule 2: If someone does not follow back, engage on their recent post first before DMing.",
        ],
        musaProTip: "Personalize every DM based on their latest post or reel. Copy-paste spam ends up in hidden requests.",
      },
    };
  }

  // Day 15 to Day 30+ (Full Scale / Standard Daily Quota)
  return {
    dayNumber: day,
    phase: "Phase 3: Full Scale Organic Outreach",
    facebook: {
      platform: "facebook",
      dayTitle: `Facebook Day ${day} (Scale) — The 30/Day Hard Ceiling`,
      summary: "You are at full capacity. Adhere strictly to the maximum limit of 30 friend requests per day.",
      metrics: [
        { label: "Friend Requests", target: "MAX 30 Requests / day", description: "Musa Khan's absolute ceiling. Never exceed!", highlight: true, warning: true },
        { label: "Pitch Accepted Friends", target: "Full Pipeline Pitching", description: "Execute 2-day workflow on all accepted leads", highlight: true },
        { label: "Interactions", target: "20-25 posts / 30 likes / 20 comments", description: "Consistent social presence" },
        { label: "Marketplace & Ads Sourcing", target: "Meta Ads Library + Marketplace", description: "Source active spenders & owners" },
      ],
      criticalRules: [
        "HARD LIMIT: Never send more than 30 friend requests in a 24-hour period.",
        "Always pitch personal owner profiles, never company pages.",
      ],
      musaProTip: "At 30 requests/day, you add ~900 targeted prospects a month. If 30-40% accept, that is 300+ warm conversations every single month.",
    },
    instagram: {
      platform: "instagram",
      dayTitle: `Instagram Day ${day} (Scale) — Multi-Angle Lead Sourcing`,
      summary: "Full outreach mode leveraging competitor followers, hashtag prospecting, and niche meme accounts.",
      metrics: [
        { label: "Daily Follows", target: "25-30 Follows / day", description: "Targeted business owners only" },
        { label: "Follow-Back DMs", target: "All New Follow-backs", description: "Next-day conversational pitch", highlight: true },
        { label: "Direct Owner DMs", target: "10-15 Personalized DMs / day", description: "Customized outreach based on content" },
        { label: "Content Routine", target: "Daily Stories + 3 Reels/week", description: "Establish undisputed authority" },
      ],
      criticalRules: [
        "Avoid rapid copy-paste messaging; spread your DMs throughout the day.",
        "Use Apify to scrape competitor content and model what is already working in your niche.",
      ],
      musaProTip: "If you have some budget later, Apollo or Sales Navigator can accelerate this, but this organic Meta system costs $0 and converts highest.",
    },
  };
}
