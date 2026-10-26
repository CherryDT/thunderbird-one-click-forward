// Migrate old configs on extension load
(async () => {
  const { forwardingConfigs, forwardingAddresses } = await browser.storage.local.get({ forwardingConfigs: [], forwardingAddresses: [] })
  if (!forwardingConfigs.length && forwardingAddresses.length) {
    const migrated = migrateV1ToV2Configs(forwardingAddresses)
    await browser.storage.local.set({ forwardingConfigs: migrated })
    await browser.storage.local.remove('forwardingAddresses')
    return
  }
  const { migrated, didMigrate } = migrateV2ToV2_1Configs(forwardingConfigs)
  if (didMigrate) {
    await browser.storage.local.set({ forwardingConfigs: migrated })
  }
})()

async function getMessageId (tab, useSelection) {
  if (useSelection && tab.mailTab) {
    const selected = await browser.mailTabs.getSelectedMessages(tab.id)
    if (selected.messages.length !== 1 || selected.id) {
      throw new Error('Select exactly one email to forward.')
    }
    return selected.messages[0].id
  }

  const message = await browser.messageDisplay.getDisplayedMessage(tab.id)
  if (!message) {
    throw new Error('Select exactly one email to forward.')
  }
  return message.id
}

async function getIdentityIdForMessage(messageId) {
  const messageHeader = await browser.messages.get(messageId)
  const account = await browser.accounts.get(messageHeader.folder.accountId)
  const identity = account.identities.find(id => messageHeader.recipients.some(r => r === id.email || r.replace(/^.*<|>.*$/g, '') === id.email))

  return (identity ?? await browser.identities.getDefault(account.id)).id
}

async function getIdentityIdFromConfig(messageId, fromIdentity) {
  if (fromIdentity === 'default') {
    return getIdentityIdForMessage(messageId)
  }
  const accounts = await browser.accounts.list()
  for (const account of accounts) {
    const identity = account.identities.find(id => id.email === fromIdentity)
    if (identity) return identity.id
  }
  // Fallback to default
  return getIdentityIdForMessage(messageId)
}

async function getTrashFolderId(accountId) {
  const account = await browser.accounts.get(accountId)
  let trashFolder = account.folders.find(f => f.type === 'trash')
  if (trashFolder) return trashFolder.id

  // Fallback to local folders trash
  const accounts = await browser.accounts.list()
  const localAccount = accounts.find(acc => acc.type === 'none') // Local Folders
  if (localAccount) {
    trashFolder = localAccount.folders.find(f => f.type === 'trash')
    if (trashFolder) return trashFolder.id
  }

  return null
}

async function getArchiveFolderId(accountId) {
  const account = await browser.accounts.get(accountId)
  let archiveFolder = account.folders.find(f => f.type === 'archive' || f.type === 'archives')
  if (archiveFolder) return archiveFolder.id

  const accounts = await browser.accounts.list()
  const localAccount = accounts.find(acc => acc.type === 'none')
  if (localAccount) {
    archiveFolder = localAccount.folders.find(f => f.type === 'archive' || f.type === 'archives')
    if (archiveFolder) return archiveFolder.id
  }

  return null
}

async function applyPostForwardAction(actionAfter, messageId, accountId) {
  if (actionAfter === 'archive') {
    if (browser.messages.archive) {
      await browser.messages.archive([messageId])
      return
    }
    const archiveId = await getArchiveFolderId(accountId)
    if (archiveId) {
      await browser.messages.move([messageId], archiveId)
    }
    return
  }

  if (actionAfter === 'trash') {
    const trashId = await getTrashFolderId(accountId)
    if (trashId) {
      await browser.messages.move([messageId], trashId)
    }
    return
  }

  if (actionAfter === 'delete') {
    if (browser.messages.delete) {
      await browser.messages.delete([messageId], true)
    }
  }
}

async function performForward(messageId, config, compose = false) {
  config = migrateV2ToV2_1Config(config)
  const identityId = await getIdentityIdFromConfig(messageId, config.fromIdentity)

  const composeDetails = {
    to: config.recipients.map(recipient => {
      if (recipient.includes('@') || recipient.includes('<')) {
        return recipient
      } else {
        return `${recipient} <${recipient}>`
      }
    }),
    identityId
  }

  const forwardType = config.forwardType === 'attachment' ? 'forwardAsAttachment' : 'forwardInline'
  const tab = await browser.compose.beginForward(messageId, forwardType, composeDetails)
  console.log(`Forwarding window opened with tabId: ${tab.id}`)

  if (!compose) {
    await new Promise(resolve => setTimeout(resolve, 1500)) // Fails if called too quickly after beginForward!
    console.log('Sent:', await browser.compose.sendMessage(tab.id))

    const messageHeader = await browser.messages.get(messageId)
    await applyPostForwardAction(config.actionAfter, messageId, messageHeader.folder.accountId)
  }
}

// Both toolbar buttons share the popup and Alt+Click shortcut.
async function handleActionClick(action, tab, info, useSelection) {
  let autoForward = false
  try {
    const messageId = await getMessageId(tab, useSelection)
    const { forwardingConfigs } = await browser.storage.local.get({ forwardingConfigs: [] })
    autoForward = info.modifiers.includes('Alt') && forwardingConfigs.length > 0
    if (autoForward) {
      // Auto-forward with first config
      await performForward(messageId, forwardingConfigs[0])
    } else {
      try {
        await action.setPopup({
          tabId: tab.id,
          popup: `popup/chooseRecipient.html?messageId=${messageId}`
        })
        await action.openPopup()
      } finally {
        // Reset popup to none to allow Alt+Click detection next time
        await action.setPopup({ tabId: tab.id, popup: "" })
      }
    }
  } catch (e) {
    console.error(e)
    browser.notifications.create({
      "type": "basic",
      "title": autoForward ? "Auto-forwarding failed!" : "Forwarding failed!",
      "message": String(e)
    })
  }
}

browser.messageDisplayAction.onClicked.addListener((tab, info) => {
  return handleActionClick(browser.messageDisplayAction, tab, info, false)
})

browser.browserAction.onClicked.addListener((tab, info) => {
  return handleActionClick(browser.browserAction, tab, info, true)
})

browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'chooseRecipient') {
    try {
      await performForward(message.messageId, message.config, message.compose)
    } catch (e) {
      console.error(e)
      browser.notifications.create({
        "type": "basic",
        "title": "Forwarding failed!",
        "message": String(e)
      })
    }
  }
})
