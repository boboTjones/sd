# Slack Deleties
#### What is Slack Deleties? 
A Chrome extension for deleting your Slack messages in bulk groups of ~20 messages at a time.

#### Why did I make Slack Deleties?
Multiple reasons: 

 - Sometimes I want to ghost off of a Slack. 
 - The UI for deleting messages on Slack is cumbersome -- I expect deliberately so, to discourage people from doing it.
 - Because I wanted to write the simplest possible Chrome extension
 
#### What should you know about Slack Deleties?

Slack Deleties going to delete __everything you select, permanently.__ Currently it doesn't prompt you to reconsider, it just deletes everything you select. If you use this, don't come crying to me if you later have regrets.

The pagination is janky. Turns out there's a reason why people use OPC to do that, but I'm enjoying doing it by hand. Sort of. 

Eventually I will extend it to search for files as well as of messages. 

#### How do I install Slack Deleties?

Read the [Getting Started Tutorial](https://developer.chrome.com/extensions/getstarted) and follow the instructions for loading an unpacked extension.

#### How do I use Slack Deleties?

* Navigate to the conversation you wish to ghost from. 
* Click on the Slack Deleties garbage truck icon. A popup will appear. 
* Click the button labeled Fetch. This will display a paginated set of your messages for that conversation.
* Either click the unlabeled Select All button in the upper left or select individual messages. 
* Click Delete. Maybe your messages will disappear, maybe they won't.

#### Known problems

* Slack Deleties uses what appears to be a deprecated Slack API endpoint. That may go away in the future.
* Deleted messages do not always disappear and must be deleted multiple times. Usually this is caused by rate limiting. 
* Pagination in the popup is execrable. Writing that code around what the Slack API returns was grisly and I gave up when it got to the point where it was usuable enough to do what I needed.

#### History

* May 2022 
    * Updated to V3
    * Refactored to fetch messages from specific conversations.