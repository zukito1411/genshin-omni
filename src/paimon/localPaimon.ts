import { getPaimonHelpReply } from './knowledge';
import { solveMath } from './math';
import { containsCredential, loadNotebook, memoryKey, putFact, searchFacts, updateNotebook, type Notebook, type NotebookResult } from './memory';
import type { PaimonContext, PaimonReply } from './types';
import { faqs } from '../data/faqs';

export interface PreparedReply { reply: PaimonReply; handled: boolean; journal: boolean; mathValue?: number; }
export interface LocalAssistant { prepare(input: string, context: PaimonContext): Promise<PreparedReply>; record(question: string, reply: PaimonReply, value?: number): Promise<void>; }
const clean = (value: string) => value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
const native = (text: string, handled = true, journal = true): PreparedReply => ({ reply: { text, source: 'native' }, handled, journal });
const limits = 'Paimon can remember what you tell her, search her local notebook, calculate, solve linear/quadratic equations, analyze number lists, convert units, and use polynomial power rules. This is a lightweight offline assistant—not a self-training neural model or live web browser.';

class LocalPaimon {
  private notebook: Notebook;
  private lastNumber?: number;
  private pending?: 'name' | 'learning' | 'forget';
  constructor(result: NotebookResult) {
    this.notebook = result.notebook;
    this.lastNumber = [...result.notebook.turns].reverse().find((turn) => turn.mathValue !== undefined)?.mathValue;
  }
  private async save(change: (notebook: Notebook) => Notebook) {
    const result = await updateNotebook(change);
    this.notebook = result.notebook;
    return result;
  }
  private async remember(label: string, value: string) {
    if (!memoryKey(label) || !value.trim()) return native('Paimon needs a label and a non-empty note to remember. Try “remember my goal is build Ayaka.”', true, false);
    const result = await this.save((notebook) => putFact(notebook, label, value));
    this.pending = undefined;
    return native(`Paimon wrote it down: ${label} — ${value}. ${result.persistent ? 'Saved locally in this browser.' : 'Browser storage is unavailable, so Paimon can keep this only for this session.'} You can say “forget ${label}” to remove it.`, true, false);
  }
  async prepare(input: string, context: PaimonContext): Promise<PreparedReply> {
    const question = clean(input);
    const query = question.toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\bfavourite\b/g, 'favorite');
    if (!question) return native('What would you like Paimon to help with, Traveler?');
    if (containsCredential(question)) return native('Please keep passwords, API keys, tokens, and private keys out of chat, Traveler. Paimon will not save this message or send it to the AI provider.', true, false);
    // Wait for journal writes and refresh this small notebook to include other tabs.
    this.notebook = (await loadNotebook()).notebook;
    this.lastNumber = [...this.notebook.turns].reverse().find((turn) => turn.mathValue !== undefined)?.mathValue;
    if (/^(?:confirm )?forget (?:everything|all(?: my)? (?:memories|memory|history))$/.test(query) || query === 'clear your memory') {
      if (!query.startsWith('confirm ') || this.pending !== 'forget') {
        this.pending = 'forget';
        return native('That would erase Paimon’s saved memories and conversation journal in this browser—not your roster or teams. To confirm, say “confirm forget everything.”', true, false);
      }
      await this.save(() => ({ version: 1, facts: [], turns: [] }));
      // Remove any fallback copy too, so a later storage outage cannot resurrect it.
      try { localStorage.removeItem('teyvat-atlas:paimon-notebook:v1'); } catch { /* Optional storage. */ }
      this.lastNumber = undefined; this.pending = undefined;
      return native('All cleared, Traveler. Paimon’s local notebook and conversation journal are empty. Your roster, teams, and farming checks are untouched.', true, false);
    }
    if (/^(?:forget|delete|remove)\s+/.test(query)) {
      const requested = memoryKey(query.replace(/^(?:forget|delete|remove)\s+(?:that\s+|my\s+)?/, ''));
      const match = this.notebook.facts.find((fact) => fact.key === requested || fact.key === `my ${requested}`);
      if (!match) return native('Paimon cannot find that exact memory. Ask “what do you remember?” to see its label.', true, false);
      await this.save((notebook) => ({ ...notebook, facts: notebook.facts.filter((fact) => fact.key !== match.key), turns: [] }));
      this.lastNumber = undefined; this.pending = undefined;
      return native(`Paimon forgot “${match.label}” and cleared the conversation journal so old messages cannot bring it back. Other saved memories are still here.`, true, false);
    }
    if (/^(?:what do you remember(?: about me)?|show (?:your |my )?(?:memory|memories|notebook)|list (?:your |my )?memories|browse (?:your )?(?:memory|memories))$/.test(query)) {
      const facts = this.notebook.facts.slice(-10).reverse();
      return native(facts.length ? `Here’s Paimon’s local notebook (${this.notebook.facts.length} saved notes):\n${facts.map((fact) => `• ${fact.label}: ${fact.value}`).join('\n')}\nThese are things you told Paimon, not independently verified facts.${this.notebook.facts.length > 10 ? '\nAsk about a topic to search the remaining notes.' : ''}\nSay “forget <label>” to remove one.` : 'Paimon’s saved notebook is empty. You can say “remember my name is Alex” or “teach crystallize => your explanation.”', true, false);
    }
    if (/^(?:what did we (?:talk about|discuss)|show (?:our |my )?(?:conversation|chat) history|what did i (?:ask|say)(?: before| earlier)?)$/.test(query)) {
      const turns = this.notebook.turns.slice(-5);
      return native(turns.length ? `Paimon found these recent questions in this browser:\n${turns.map((turn) => `• ${turn.question}`).join('\n')}\nThe journal keeps only the latest 30 exchanges.` : 'There aren’t any saved conversations here yet, Traveler.', true, false);
    }
    if (/^(?:how (?:does|do) (?:your |you )?(?:memory|learning|learn) work|(?:memory|local|offline) help|what can you (?:do|learn))$/.test(query)) {
      return native(`${limits}\nSave: “remember my goal is build Ayaka.”\nTeach: “teach my rotation => skill, burst, then normal attacks.”\nRead: “what do you remember?”\nErase: “forget everything” (confirmation required).\nSaved memories stay local and are not automatically sent to the cloud AI.`);
    }
    const nameMatch = /^(?:remember\s+)?(?:my name is|call me)\s+(.+)$/i.exec(question);
    if (nameMatch) return this.remember('name', clean(nameMatch[1]).replace(/[.!]+$/, '').slice(0, 80));
    const favorite = /^(?:remember\s+)?my favou?rite\s+(character|food|team|weapon)\s+is\s+(.+)$/i.exec(question);
    if (favorite) return this.remember(`favorite ${favorite[1].toLowerCase()}`, clean(favorite[2]).replace(/[.!]+$/, ''));
    const main = /^(?:remember\s+)?i main\s+(.+)$/i.exec(question);
    if (main) return this.remember('main character', clean(main[1]).replace(/[.!]+$/, ''));
    const likes = /^(?:remember\s+)?i (?:also )?(?:like|enjoy)\s+(.+)$/i.exec(question);
    if (likes) return this.remember('likes', clean(likes[1]).replace(/[.!]+$/, ''));
    const teach = /^teach(?:\s+paimon)?\s*:?\s*(.{1,120}?)\s*(?:=>|->)\s*(.+)$/i.exec(question);
    if (teach) return this.remember(teach[1], clean(teach[2]));
    const remember = /^remember\s+(.+)$/i.exec(question);
    if (remember) {
      const pair = /^(?:that\s+)?(?:my\s+)?(.{1,120}?)\s*(?:=|:|\bis\b|\bare\b)\s*(.+)$/i.exec(remember[1]);
      if (pair) return this.remember(pair[1], clean(pair[2]));
      return native('Give Paimon a label and a note, like “remember my goal is build Ayaka” or “remember snacks: sweet madames.” That makes it easier to find later.');
    }
    if (this.pending === 'forget') {
      this.pending = undefined;
      if (/^(?:no|cancel|never mind|nevermind)$/.test(query)) return native('Cancelled! Paimon kept your notebook safe.', true, false);
    }
    const math = solveMath(question, this.lastNumber);
    if (math) {
      this.lastNumber = math.value;
      return { reply: { text: math.text, source: 'native' }, handled: math.supported || !math.capabilityMissing, journal: true, mathValue: math.value };
    }
    if (/^(?:what(?:'s| is) my name|who am i|do you know my name)$/.test(query)) {
      const fact = this.notebook.facts.find((entry) => entry.key === 'name');
      return native(fact ? `You told Paimon to call you ${fact.value}! Paimon found that in her local notebook.` : 'Paimon doesn’t have your name saved yet. What should Paimon call you? You can say “my name is Alex.”');
    }
    if (/^(?:what do i (?:like|enjoy)|what(?:'s| is) my main(?: character)?)$/.test(query)) {
      const key = query.includes('main') ? 'main character' : 'likes';
      const fact = this.notebook.facts.find((entry) => entry.key === key);
      return native(fact ? `You told Paimon: ${fact.value}. That’s from your local notebook.` : 'Paimon doesn’t have that saved yet. Tell her “I like …” or “I main …”.');
    }
    const notes = searchFacts(this.notebook, query);
    if (notes.length && /^(?:what|who|tell|recall|do you|remember|search|find)\b/.test(query)) {
      return native(`From what you taught Paimon:\n${notes.map((fact) => `• ${fact.label}: ${fact.value}`).join('\n')}\nPaimon hasn’t independently verified these notes. You can correct one with “remember <label> is <new value>.”`);
    }
    if (/^(?:yes|yeah|yep|sure|okay|ok)$/.test(query)) {
      const pending = this.pending; this.pending = undefined;
      return native(pending === 'learning' ? 'Great! Type “teach <topic> => <explanation>.” Paimon will save it as something you taught her, not as a verified fact.' : pending === 'name' ? 'What should Paimon call you? Say “my name is …” to save it in this browser.' : 'What are we saying yes to, Traveler? Paimon needs a little more context.');
    }
    if (/^(?:no|nope|not now|never mind|nevermind)$/.test(query)) { this.pending = undefined; return native('No problem, Traveler. What would you like to talk about instead?'); }
    if (/^(?:explain (?:that|it)|why|more detail|show (?:the )?steps|continue)$/.test(query)) {
      const last = this.notebook.turns.at(-1);
      return native(last ? `We were discussing “${last.question}.”\n${last.answer}\n${last.mathValue !== undefined ? 'Paimon uses parentheses first, then powers, then multiplication/division, then addition/subtraction. Tell Paimon which part you want broken down.' : 'Which part would you like Paimon to explain? Her offline knowledge is limited, so she will ask rather than invent details.'}` : 'Which question should Paimon explain? There’s no earlier conversation saved here yet.');
    }
    if (/\bemergency food\b/.test(query)) return native('Hey! Paimon is your guide, not emergency food! Now, where were we, Traveler?');
    if (/\b(?:i feel|i am|i'm)\s+(?:sad|tired|stressed|lonely|upset)\b/.test(query)) return native('Paimon’s sorry you’re having a rough time, Traveler. Want to talk about what happened, or pick one small thing to work on together?');
    if (/\b(?:are you (?:a real ai|conscious|sentient)|neural|train yourself)\b/.test(query)) return native(`Paimon is an in-app assistant with a cheerful personality. ${limits}`);
    if (/^(?:hi|hello|hey|yo)\b/.test(query)) {
      const savedName = this.notebook.facts.find((fact) => fact.key === 'name')?.value;
      this.pending = savedName ? undefined : 'name';
      return native(savedName ? `Hi, ${savedName}! Paimon’s glad you’re back. What are we working on today?` : 'Hi, Traveler! Paimon’s ready to help. What should Paimon call you? Say “my name is …” if you want her to remember it locally.', false);
    }
    if (/\b(?:how are you|are you okay)\b/.test(query)) return native('Paimon is doing great—a little hungry, but ready for adventure! How are you doing, Traveler?', false);
    if (/\b(?:time is it|what(?:'s| is) the time|current time)\b/.test(query)) return native(`It’s ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())} on your device.`, true);
    if (/\b(?:today's date|what(?:'s| is) (?:the )?date|what day is it)\b/.test(query)) return native(`Today is ${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}, according to your device.`, true);
    // Exact built-in answers take precedence over broad navigation shortcuts.
    const faq = faqs.find((entry) => memoryKey(entry.question) === memoryKey(question));
    if (faq) return native(`Paimon’s built-in guide says: ${faq.answer}\nThis is an offline tip, not a check of the current game patch.`, false);
    const help = getPaimonHelpReply(question, context.page, context.name);
    if (help.route || /\b(?:thanks|thank you|bye|goodbye|joke|who are you)\b/.test(query) || /^(?:help|what should i do)$/.test(query)) return { reply: help, handled: false, journal: true };
    if (this.pending === 'name' && !/^(?:what|how|why|when|where|who|can|do|does|is|are|tell|ask|please|no|yes)\b/.test(query) && /^[\p{L}\p{M}][\p{L}\p{M}'’-]*(?: [\p{L}\p{M}][\p{L}\p{M}'’-]*){0,2}$/u.test(question) && question.length <= 80) {
      return this.remember('name', question);
    }
    this.pending = 'learning';
    return native('Paimon doesn’t have a reliable offline answer for that yet, Traveler. Is it a calculation, a game question, or something you want to teach her? You can say “teach <topic> => <explanation>.” She’ll keep it as a user-taught note instead of pretending she verified it.', false);
  }
  async record(question: string, reply: PaimonReply, value?: number) {
    // Do not carry an offline question/prompt forward if cloud AI said something else.
    if (reply.source === 'ai') this.pending = undefined;
    if (containsCredential(`${question} ${reply.text}`)) return;
    const id = window.crypto.randomUUID();
    const turn = { id, question: clean(question), answer: reply.text.slice(0, 2400), at: Date.now(), ...(value === undefined ? {} : { mathValue: value }) };
    await this.save((notebook) => ({ ...notebook, turns: [...notebook.turns, turn] }));
  }
}
let engine: Promise<LocalPaimon> | undefined;
export function getLocalPaimon() { engine ??= loadNotebook().then((result) => new LocalPaimon(result)); return engine; }
