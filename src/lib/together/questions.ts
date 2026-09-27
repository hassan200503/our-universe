/**
 * One question a day for both of you. The same question all day, a new one at
 * midnight Nairobi time. Answers stay hidden from each other until you've both
 * written yours, so neither of you copies the other.
 */
export const QUESTIONS = [
  "What's a small thing I did recently that made you smile?",
  "If we could spend tomorrow anywhere in Kenya, where would we go?",
  "What song reminds you of us right now?",
  "What's something you're proud of this week?",
  "Describe your perfect lazy Sunday with me.",
  "What's one thing you'd love us to learn together?",
  "What bird would you be, and why?",
  "What's a memory of us you replay in your head?",
  "What's the next thing you want to knit, build, or make?",
  "What made today hard, and how can I help?",
  "What's a dream you haven't told many people about?",
  "Which of our dates would you relive first?",
  "What do you miss most about me when we're apart?",
  "What's a question you've always wanted to ask me?",
  "If we had a whole free week, what would we do?",
  "What's something new you learned today?",
  "What does home feel like to you?",
  "What are three words you'd use to describe us?",
  "What's a habit of mine you secretly love?",
  "Where do you see us in five years?",
  "What's the best meal we've shared?",
  "What film or show should we watch together next?",
  "What are you looking forward to this month?",
  "What's a fear you'd like to overcome?",
  "What's one thing you'd like more of in our relationship?",
  "What made you fall for me?",
  "What's your favourite way to be comforted?",
  "What's a place in nature you'd love to show me?",
  "If you could master one skill overnight, what would it be?",
  "What's the kindest thing a stranger has done for you?",
  "What would our perfect little house look like?",
  "What's a tradition you'd love us to start?",
  "What's something that made you laugh this week?",
  "What's the most beautiful thing you saw today?",
  "What song would be the soundtrack of our story?",
  "What do you want to celebrate this weekend, however small?",
  "What's a book or idea that changed how you think?",
  "What do you need more of this week: rest, fun, or focus?",
  "What's one adventure we must go on this year?",
  "How do you like to be loved when you're tired?",
  "What's a childhood memory you treasure?",
  "What are you most grateful for about us today?",
  "If we wrote a letter to our future selves, what would it say?",
  "What's a little luxury that makes your day better?",
  "What's a question from science or nature you wonder about?",
  "What's something you want me to know but haven't said?",
  "Which season feels most like us, and why?",
  "What's your idea of a perfect video call date?",
  "What would you name our first pet?",
  "What do you admire most about how I handle things?",
  "What's one goal we could cheer each other on for this month?",
  "What's a sound that instantly makes you calm?",
  "When did you last feel really proud of me?",
  "What's a place we've been that felt like magic?",
  "What's a silly thing you'd love to do together?",
  "What does a good day look like for you right now?",
  "What's a food you want us to cook together?",
  "What part of your world do you wish I knew more about?",
  "What's a sweet message you'd like to wake up to tomorrow?",
  "What's one thing that always reminds you of me?",
];

/** Today's date in Nairobi, as YYYY-MM-DD. */
export function nairobiDay(now: Date): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

export function questionFor(day: string): string {
  let h = 2166136261;
  for (const ch of `ou-q:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const epochDay = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400_000);
  // Walk through the list in a shuffled order that repeats only after every question is used.
  const n = QUESTIONS.length;
  const step = [7, 11, 13, 17, 19, 23, 29, 31].find((s) => n % s !== 0) ?? 1;
  return QUESTIONS[(((epochDay * step + (h >>> 0)) % n) + n) % n];
}
