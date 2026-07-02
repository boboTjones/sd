# Slack Deleties
#### What is Slack Deleties? 
A Chrome extension for deleting your Slack messages in bulk groups of ~20 messages at a time.

#### Why did I make Slack Deleties?
Multiple reasons: 

 - Sometimes I want to ghost off of a Slack. 
 - Sometimes you can't trust even the closest people in your life to not screenshot your conversations and use them against you.
 - The UI for deleting messages on Slack is cumbersome -- I expect deliberately so, to discourage people from doing it.
 - Because I wanted to write the simplest possible Chrome extension
 
#### What should you know about Slack Deleties?

Slack Deleties going to delete __everything you select, permanently.__ Currently it doesn't prompt you to reconsider, it just deletes everything you select. If you use this, don't come crying to me if you later have regrets.

It finds your messages by reading the open conversation directly (`conversations.history`, plus `conversations.replies` for anything you said in a thread) and keeping only the ones you wrote. It falls back to Slack's search endpoints if that ever fails. This is more reliable than search alone -- Slack's search index doesn't return DMs, which is why earlier versions came up empty there.

Deletion is throttled: `chat.delete` only removes one message per call, so Deleties deletes them one at a time with a delay between each and backs off automatically when Slack rate-limits it. That means a big selection is deliberately slow, but the messages actually go away instead of silently failing.

Eventually I will extend it to search for files as well as of messages. 

#### How do I install Slack Deleties?

Read the [Getting Started Tutorial](https://developer.chrome.com/extensions/getstarted) and follow the instructions for loading an unpacked extension.

#### How do I use Slack Deleties?

* Navigate to the conversation you wish to ghost from. 
* Click on the Slack Deleties garbage truck icon. A popup will appear. 
* Click the button labeled Fetch. This will display a paginated set of your messages for that conversation.
* Either click the Select All checkbox in the table header or select individual messages. 
* Click "delete selected." The messages you picked disappear from the list as they're deleted.

#### Known problems

* It leans on internal, undocumented Slack behavior (a browser session token plus a couple of endpoints Slack doesn't officially support). Slack can change any of that at any time and break it.
* Thread replies require an extra API call per thread, so fetching a conversation with lots of threads is slower.
* Because deletion is rate-limit-throttled, deleting a large backlog takes a while. That's on purpose -- it's the price of the messages reliably going away.

#### History

* July 2026
    * Modernized for current Manifest V3 (fixed the removed page-action API and localStorage injection).
    * Rewrote message discovery to read the conversation directly via `conversations.history` / `conversations.replies`, with the search endpoints as a fallback. This fixes DMs, which Slack's search never returned.
    * Made deletion reliable: serial `chat.delete` with a delay and automatic backoff on rate limits.
    * New accessible dark theme (high contrast, keyboard focus rings, screen-reader labels).
* May 2022 
    * Updated to V3
    * Refactored to fetch messages from specific conversations.
