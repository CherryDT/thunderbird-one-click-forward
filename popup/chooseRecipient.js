async function buildConfigsList () {
  const messageId = Number(new URLSearchParams(window.location.search).get('messageId'))
  const { forwardingConfigs } = await browser.storage.local.get({ forwardingConfigs: [] })
  const { migrated, didMigrate } = migrateV2ToV2_1Configs(forwardingConfigs)
  if (didMigrate) {
    await browser.storage.local.set({ forwardingConfigs: migrated })
  }

  if (!migrated.length) {
    const message = document.createElement('p')
    message.textContent = 'No forwarding configurations exist! '
    const link = document.createElement('a')
    link.href = '#'
    link.addEventListener('click', () => { browser.runtime.openOptionsPage(); window.close(); })
    link.textContent = 'Create in settings'
    message.appendChild(link)
    document.getElementById('configs').appendChild(message)
    document.getElementById('shiftInstruction').style.display = 'none'
    return
  }

  for (const config of migrated) {
    const option = document.createElement('button')
    const displayTitle = config.name || getDefaultTitle(config.recipients)
    option.innerText = displayTitle
    const actionLabels = {
      none: 'Do nothing',
      archive: 'Archive',
      trash: 'Trash',
      delete: 'Delete permanently'
    }
    option.title = `Recipients: ${config.recipients.join(', ')}\nFrom: ${config.fromIdentity}\nType: ${config.forwardType}\nAfter: ${actionLabels[config.actionAfter] || 'Do nothing'}`
    option.addEventListener('click', e => {
      try {
        browser.runtime.sendMessage({ action: 'chooseRecipient', messageId, config, compose: e.shiftKey })
        window.close()
      } catch (e) {
        console.error(e)
        const errorDiv = document.getElementById('error')
        const redSpan = errorDiv.querySelector('span.red')
        redSpan.textContent = `Sending message failed! ${e}`
        errorDiv.dataset.view = 'red'
      }
    })
    document.getElementById('configs').appendChild(option)
  }
}

document.addEventListener('DOMContentLoaded', buildConfigsList)
