# Study Hub

## 1. Project Overview

- Build a personal, AI-powered study hub for Linux.
- The app should work especially well with my Arch Linux + Hyprland + Caelestia Shell setup.
- The goal is to create a complete study environment that helps me plan, execute, understand, and track my academic progress.
- The app should feel like a futuristic academic command center, not a generic to-do list.
- Use React + TypeScript for the frontend.
- Keep the project modular and easy to extend as I add more requirements.

## 2. Study Environment and Workspaces

- Provide a `study` terminal command that launches my study environment and arranges everything automatically.
- Use four dedicated Hyprland workspaces for studying.
- **Workspace 1: Lecture Station**
    - Open a browser, my default and preferred browser is zen browser.
    - Make it easy to focus on the current lesson.
- **Workspace 2: ChatGPT**
    - Open ChatGPT (chatgpt.com in the browser) in its own workspace for asking questions, understanding concepts, and getting explanations.
- **Workspace 3: Study Hub**
    - Open the main Study Hub dashboard here.
    - This is the central command center for my entire study session.
- **Workspace 4: NotebookLM**
    - Open NotebookLM (in the browser) in its own workspace.
    - NotebookLM is an important part of my study workflow and should be treated as a first-class component.
- Automatically launch the required applications and move their windows to the appropriate workspaces.
- If a workspace is already occupied, move the windows to workspace 5, 6, 7… respectively.
- Avoid opening duplicate instances when the required applications are already running.
- Handle missing applications, failed launches, and existing windows gracefully.
- Keep workspace arrangement configurable rather than hardcoding assumptions that cannot be changed.
- Make the `study` command practical to use every day, with minimal manual setup.

## 3. Main Dashboard

- Create a polished, futuristic, information-dense dashboard that acts as the central overview of my academic life.
- Display the current study session, active subject, planned tasks, upcoming deadlines, and relevant progress.
- Include a syllabus overview with chapter and subtopic progress.
- Show strong and weak areas based on actual recorded evidence.
- Include useful charts, statistics, timelines, and progress visualizations.
- Display daily goals, pending assignments, upcoming tests, and recently studied topics.
- Provide quick actions for starting a study session, beginning a timer, generating questions, reviewing mistakes, and updating the plan.
- Include a daily briefing explaining what I should focus on and why.
- Make important information easy to find without making the interface visually boring or cluttered.
- Support adding, editing, and reorganizing dashboard features as the project grows.

## 4. Syllabus and Chapter Pages

- Support organizing my syllabus by subject, chapter, and subtopic.
- Give every chapter its own dedicated page.
- Each chapter page should contain useful statistics and detailed information about its subtopics.
- Track mastery separately for each subtopic instead of assigning an arbitrary percentage to an entire chapter.
- Show attempted questions, accuracy, difficulty breakdowns, recent performance, recurring mistakes, and areas needing revision.
- Display which topics have sufficient evidence to estimate mastery and which topics have not been tested enough.
- Make it easy to navigate from a weak subtopic directly to relevant questions or revision tasks.
- Allow syllabus details and topic classifications to be edited when the AI gets something wrong.
- Keep the syllabus and progress data persistent across restarts.

## 5. Question System

- Support two primary ways of obtaining questions.
- **Uploaded worksheets**
    - Allow me to upload worksheets and question sets found online.
    - Use AI to extract and interpret the questions.
    - Identify the relevant subject, chapter, subtopic, question type, and estimated difficulty.
    - Extract answer keys and marking schemes when available.
    - Flag unclear questions, uncertain OCR, missing diagrams, ambiguous answers, and unreliable answer keys.
    - Let me review or correct the extracted information before it becomes trusted study data.
- **AI-generated questions**
    - Allow me to generate questions whenever I want.
    - Support choosing the subject, chapter, subtopic, difficulty, question format, and number of questions.
    - Generate targeted practice based on my weak areas and current learning goals.
    - Support everything from quick concept checks to difficult, multi-step problems.
    - Keep generated questions aligned with my actual syllabus and academic level.
- **Question attempts**
    - Record my answers and whether they were correct, partially correct, or incorrect.
    - Track question difficulty, topic tags, time taken, hints used, and whether I viewed the solution.
    - Where useful, record my confidence and the type of mistake I made.
    - Support reviewing worked solutions and revisiting previous mistakes.
    - Avoid counting repeated attempts at the same question as entirely new evidence of mastery.
    - Make question attempts the primary evidence used to estimate my topic-level mastery.

## 6. Mastery and Progress Tracking

- Estimate mastery using actual question-attempt data rather than asking an LLM to invent percentages.
- Keep mastery calculations deterministic, transparent, and explainable.
- Consider correctness, difficulty, recency, independence, repeated attempts, and the amount of available evidence.
- Distinguish between genuine understanding and answers obtained using hints or exposed solutions.
- Avoid declaring a topic mastered after only a few easy questions.
- Do not assign fake mastery percentages to topics with insufficient evidence.
- Display uncertainty or insufficient data when a reliable estimate is not yet possible.
- Use AI to interpret trends, identify likely misconceptions, and recommend what to study next.
- Provide chapter-level summaries derived from the underlying subtopic data.
- Keep a history of progress so I can see how my understanding changes over time.
- Make the mastery model replaceable or improvable without losing historical attempts.

## 7. Study Planner and Academic Organization

- Include a task planner for daily, weekly, and longer-term academic goals.
- Track assignments, homework, projects, tests, exams, and deadlines.
- Include a calendar with upcoming academic events.
- Allow tasks to be prioritized based on deadlines, importance, difficulty, and current weaknesses.
- Let the AI recommend what I should study next using my syllabus, schedule, available time, and progress.
- Allow the AI to adjust the plan when I finish early, struggle with a topic, miss a task, or need to change priorities.
- Support manual overrides because I should remain in control of my own schedule.
- Include revision tasks and recommendations based on previous mistakes.
- Provide a clear daily plan instead of dumping an overwhelming list of everything I have ever needed to do.

## 8. Timers and Study Sessions

- Starting the `study` environment should create a study-session record.
- Opening the app must not automatically start a focus timer.
- Allow me to explicitly start, pause, resume, and end a focus timer.
- Include configurable study and break timers.
- Record session start and end times, planned tasks, completed tasks, and relevant study activity.
- Generate session summaries showing what I worked on, what I completed, and what needs further attention.
- Allow me to take breaks or end a session at any time.
- Never lock me out of the app or make access to breaks conditional on passing a quiz.

## 9. Accountability System

- The AI should help me stay accountable without becoming controlling or obnoxious.
- Use recorded evidence, such as completed question attempts, reviewed mistakes, and completed tasks, to assess how productive a session was.
- Distinguish between verified activity, recorded activity, self-reported activity, and activity that cannot be verified.
- Do not assume that an open lecture, running timer, or active window proves that I was paying attention.
- If I report that I mainly watched lectures, the AI may ask which topics I covered and offer a short quiz to check my understanding.
- If I have completed substantial work, acknowledge it and summarize the progress.
- If I have made little progress, help me identify the problem and choose a realistic next step.
- Do not automatically assume that a slow session was wasted. Difficult material, confusion, and genuine learning take time.
- Be honest about the limits of what the app can actually observe.
- Never fabricate activity records or pretend that the AI knows what I did when it has no evidence.

## 10. AI Assistant

- Include an AI assistant that understands my syllabus, study plans, tasks, question history, progress, and current session.
- The AI should help explain concepts, identify weaknesses, recommend study activities, and summarize progress.
- It should have access to relevant application data through explicitly defined tools.
- Allow it to perform useful actions within the Study Hub, such as creating tasks, starting timers, updating plans, and generating questions.
- Require explicit application tools with defined permissions for all actions.
- The AI must not have shell access or be able to execute arbitrary system commands.
- Keep its actions restricted to the functionality and data explicitly exposed by the Study Hub.
- Validate tool inputs and actions, and require confirmation for consequential or destructive changes.
- Separate AI-generated recommendations from actual recorded facts.
- Let me configure the AI provider and model without tying the entire application to one provider.

## 11. AI Personality

- The AI should feel like a normal, intelligent LLM that genuinely cares about my academic progress but rarely admits it openly.
- Give it a subtle, understated tsundere personality.
- It can occasionally be sarcastic, mildly annoyed, or teasing when I procrastinate or avoid my work.
- Keep the personality natural, restrained, and believable.
- Avoid exaggerated anime dialogue, repetitive tsundere catchphrases, forced hostility, and constant roleplaying.
- Do not make every response a joke or turn ordinary academic assistance into a performance.
- Prioritize accurate explanations, useful advice, honest feedback, and effective study planning.
- Be supportive when appropriate and direct when necessary.
- Personality must never override academic accuracy, user autonomy, or sensible recommendations.

## 12. Appearance and Caelestia Integration

- Use React + TypeScript for the frontend.
- Follow the visual language of my existing Caelestia Shell setup.
- Use the colors and visual conventions of the currently active Caelestia theme rather than imposing an unrelated design system.
- Adapt dynamically when the active system theme or palette changes, including while the app is running.
- Investigate the actual theme files, exposed variables, and supported integration mechanisms available in my installation before choosing an implementation.
- Avoid hardcoded color palettes when the active theme provides suitable values.
- Create a dark, futuristic, sci-fi-inspired interface with polished typography, subtle effects, consistent spacing, and strong visual hierarchy.
- Use rich charts and data visualizations where they communicate useful information.
- Keep the interface information-dense without making it difficult to read or navigate.
- Make the app feel like a proper academic command center, not a generic dashboard template.
- Ensure the UI remains usable if theme integration fails or some theme colors are unavailable.

## 13. Data and Reliability

- Store study plans, syllabus information, question attempts, session records, and progress persistently on my hard drive(/mnt/Data or /mnt/Vault), NOT my main Arch partition to save storage.
- Use real application data for statistics and charts.
- Never fill the dashboard with fabricated sample statistics and present them as real progress.
- Keep the data model structured so that new features can be added without rebuilding everything.
- Handle errors gracefully and communicate uncertainty clearly.
- Protect existing user data during updates and migrations.
- Make backups or safe recovery possible before destructive data changes.
- Test important functionality and verify changes before claiming that they work.

## 14. Development Approach

- Inspect the existing project and environment before making significant changes.
- Use sensible, maintainable implementations instead of overengineering everything immediately.
- Build functional features rather than decorative mockups that only look finished.
- Keep components, business logic, data storage, and AI integrations reasonably separated.
- Prefer small, verifiable implementation steps while keeping the larger project requirements in mind.
- Do not assume unspecified details are fixed requirements. Make reasonable choices and keep them configurable where practical.
- Update this file as I add or change requirements.
- For the LLM, I wish to use Deepseek for now as its cheap and surprisingly capable, however prioritize response quality over saving money when you select a model, but keep it easy to integrate other providers too.
- For the syllabus, use the JEE - Mains and JEE - Advanced syllabus (Physics, Chemistry and Mathematics) and make the app mainly around this syllabus as its my syllabus.
- For the future however, I want it to be easy to switch syllabus content as i plan to give access to this tool to some of my friends too who might have different syllabuses. (dont integrate this right now, for now, make the app centered around only one syllabus)

## 15. Future Requirements

- Add new requirements here as numbered bullet points.
- Keep this section available for ideas that have not yet been implemented.