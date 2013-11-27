// Global Variables
var DEFAULT_SHORTCUT = "Shortcut"
  , DEFAULT_AUTOTEXT = "Expanded Text"
  , KEYCODE_ENTER = 13
  , KEYCODE_TAB = 9
  , ANIMATION_FAST = 200
  , ANIMATION_NORMAL = 400;
var FIRST_RUN_KEY = 'autoTextExpanderFirstRun';
var BACKUP_KEY = 'autoTextExpanderBackup'
  , BACKUP_TIMESTAMP_KEY = 'autoTextExpanderBackupTimestamp';

// Document ready
$(function()
{
	// When user types into input fields
	$('#edit').on('keydown', 'input, textarea', editRowHandler);

	// Need to do the onclick clearing here, inline js not allowed
	$('#edit').on('focus', 'input.shortcut', function(event) {
		if (this.value == DEFAULT_SHORTCUT) { this.value = ''; }
	});
	$('#edit').on('focus', 'textarea.autotext', function(event) {
		if (this.value == DEFAULT_AUTOTEXT) { this.value = ''; }
	});
	$('#edit').on('blur', 'input.shortcut', function(event) {
		if (this.value == '') { this.value = DEFAULT_SHORTCUT; }
	});
	$('#edit').on('blur', 'textarea.autotext', function(event) {
		if (this.value == '') { this.value = DEFAULT_AUTOTEXT; }
	});

	// Button handlers
	$('#restore').click(restoreShortcuts);
	$('#backup').click(backupShortcuts);
	$('#refresh').click(setupShortcuts);
	$('#edit').on('click', '.remove', removeRow);
	$('#add').click(function(event) {
		addRow().find('.shortcut').focus().select();
	});
	$('#save').click(function(event) {
		saveShortcuts();
	});
	$('.backToTop').click(function(event) {
		event.preventDefault();
		$('html, body').animate({scrollTop: 0}, ANIMATION_NORMAL);
	});

	// Prevent form submit
	$('form').submit(function(event) {
		event.preventDefault();
	});

	// Setup shortcuts
	setupShortcuts();
});

// Setup and populate edit table shortcuts
function setupShortcuts()
{
	console.log("setupShortcuts");

	var reloadStartTime = new Date();	// Keep track of time
	$('#refresh').find('img').attr('src', 'images/refresh.gif');
	$('#edit').fadeOut(ANIMATION_FAST, function() {
		$(this).html('').fadeIn(ANIMATION_FAST, function()
		{
			// Get existing shortcuts
			chrome.storage.sync.get(null, function(data)
			{
				if (chrome.runtime.lastError) {	// Check for errors
					console.log(chrome.runtime.lastError);
					alert("Error retrieving shortcuts!");
				}
				else if (!$.isEmptyObject(data)) // Check that data is returned
				{
					// Loop through shortcuts and add to edit table,
					//  case insensitive sorted by shortcut
					var keys = Object.keys(data);
					keys.sort(function(a, b) {
						return a.toLowerCase().localeCompare(b.toLowerCase());
					});
					$.each(keys, function(index, key) {
						addRow(key, data[key]);
					});

					// Add special class to these rows to indicate saved
					$('tr').addClass('saved');
				}
				else	// No shortcuts? Check if first run on this computer
				{
					chrome.storage.local.get(FIRST_RUN_KEY, function(firstRun)
					{
						if (chrome.runtime.lastError) {		// Check for errors
							console.log(chrome.runtime.lastError);
						}
						else if (!firstRun[FIRST_RUN_KEY])		// First run
						{
							// Flag first run
							firstRun[FIRST_RUN_KEY] = true;
							chrome.storage.local.set(firstRun);

							// Example shortcuts
							addRow('brb', 'be right back');
							addRow('e@', 'email.me@carlinyuen.com');
							addRow('hbd', "Hey! Just wanted to wish you a happy birthday; hope you had a good one!");
							addRow('MYSIG ', '<strong>. Carlin</strong>\nChrome Extension Developer\nemail.me@carlinyuen.com');
							addRow('printDate', 'it is %d(MMMM Do YYYY, h:mm:ss a) right now');

							// Save
							saveShortcuts();
						}
					});
				}

				// Set textarea height to fit content and resize as user types
				$('textarea').autosize();

				// Add extra input field if no existing shortcuts
				if (!$('tr').get().length) {
					addRow().find('.shortcut').focus().select();
				}

				// Add some delay so it looks like it's doing some work
				var reloadTimeInMilliseconds = (new Date()).getTime() - reloadStartTime.getTime();
				var reloadIconRefreshDelay = (1000 - reloadTimeInMilliseconds);
				if (reloadIconRefreshDelay < 0) {
					reloadIconRefreshDelay = 0;
				}

				// Done! Set reloader icon back to default reload
				setTimeout(function() {
					$('#refresh').find('img').attr('src', 'images/reload.png');
				}, reloadIconRefreshDelay);
			});
		});
	});

	// Update timestamp of backup
	updateBackupTimestamp();
}

// When a row in the edit table gets typed in
function editRowHandler(event)
{
	// Check to see if input pair is valid
	var keyCode = event.keyCode || event.which;
	var $target = $(event.target);
	var $input = $target.parents('tr');
	validateRow($input, function(errors)
	{
		if (errors.shortcut) {
			$input.find('.shortcut').addClass('error').attr('title', errors.shortcut);
		} else {
			$input.find('.shortcut').removeClass('error').removeAttr('title');
		}

		if (errors.autotext) {
			$input.find('.autotext').addClass('error').attr('title', errors.autotext);
		} else {
			$input.find('.autotext').removeClass('error').removeAttr('title');
		}
	});

	// If enter pressed on shortcut field, move to autotext
	if (keyCode == KEYCODE_ENTER && $target.hasClass('shortcut'))
	{
		event.preventDefault();		// prevent submitting form
		$target.parents('tr').find('.autotext').focus().select();
	}

	// Can't seem to capture TAB key though!
	else if (keyCode == KEYCODE_TAB && $target.hasClass('autotext')) {
		addRow().find('.shortcut').focus().select();
	}
}

// Remove shortcut row in edit table
function removeRow(event) {
	$(this).parents('tr').fadeOut('fast', function() {$(this).remove();});
}

// Add new row to shortcuts edit table
function addRow(shortcut, autotext)
{
	if ($('tr').length >= chrome.storage.sync.MAX_ITEMS) {
		console.log(chrome.i18n.getMessage("ERROR_OVER_ITEM_QUOTA"));
		alert(chrome.i18n.getMessage("ERROR_OVER_ITEM_QUOTA")
			+ " Max # Items: " + chrome.storage.sync.MAX_ITEMS);
		return $(this);
	}

	return $(document.createElement('tr'))
		.append($(document.createElement('td'))
			.attr('width', '16px')
			.append($(document.createElement('a'))
				.attr('href', '#')
				.addClass('remove')
				.attr('title', 'Remove Shortcut')
				.append($(document.createElement('img'))
					.attr('src', 'images/remove.png')
					.attr('alt', 'x')
				)
			)
		)
		.append($(document.createElement('td'))
			.attr('width', '92px')
			.append($(document.createElement('input'))
				.attr('type', 'text')
				.addClass('shortcut')
				.attr('value', shortcut || DEFAULT_SHORTCUT)
			)
		)
		.append($(document.createElement('td'))
			.append($(document.createElement('textarea'))
				.addClass('autotext')
				.text(autotext || DEFAULT_AUTOTEXT)
			)
		)
		.hide().prependTo('#edit').fadeIn(ANIMATION_FAST);
}

// Validate if row has valid shortcut info
function validateRow($input, callback)
{
	// Check for errors
	var errors = {};
	var shortcut = $input.find('.shortcut').val();
	var autotext = $input.find('.autotext').val();

	// Check not empty
	if (!shortcut || shortcut == DEFAULT_SHORTCUT || !shortcut.length) {
		errors.shortcut = ' - Invalid shortcut text.';
	}
	if (!autotext || autotext == DEFAULT_AUTOTEXT || !autotext.length) {
		errors.autotext = ' - Invalid expanded text.';
	}

	// Check not over max size
	var itemSize = JSON.stringify({shortcut:autotext}).length;
	if (itemSize >= chrome.storage.sync.QUOTA_BYTES_PER_ITEM) {
		console.log(chrome.i18n.getMessage("ERROR_OVER_SPACE_QUOTA"));
		errors.autotext = " - Over max storage item size. Please reduce shortcut or autotext length.";
	}

	// Callback if given
	if (callback) {
		callback(errors);
	}
	return !errors.shortcut && !errors.autotext;
}

// Save shortcuts to chrome sync data
function saveShortcuts(completionBlock)
{
	console.log("saveShortcuts");

	// Collect list of valid shortcuts
	var duplicates = [];
	var shortcuts = {};
	$('tr').each(function(index)
	{
		var $row = $(this);

		// If pair is valid, and no duplicates, add to list
		if (validateRow($row))
		{
			var shortcut = $row.find('.shortcut').val();
			if (!shortcuts[shortcut]) {
				shortcuts[shortcut] = $row.find('.autotext').val();
			} else {
				duplicates.push(shortcut);
			}
		}
	});

	// Check duplicates
	if (duplicates.length) {
		console.log(chrome.i18n.getMessage("ERROR_DUPLICATE_ITEMS"));
		alert(chrome.i18n.getMessage("ERROR_DUPLICATE_ITEMS")
			+ '\n - ' + duplicates.join('\n - '));
		return false;
	}

	// Check storage capacity
	if (JSON.stringify(shortcuts).length >= chrome.storage.sync.QUOTA_BYTES) {
		console.log(chrome.i18n.getMessage("ERROR_OVER_SPACE_QUOTA"));
		alert(chrome.i18n.getMessage("ERROR_OVER_SPACE_QUOTA")
			+ " Chrome max capacity: " + chrome.storage.sync.QUOTA_BYTES + " characters");
		return false;
	}

	// Clear old shortcuts
	chrome.storage.sync.clear(function()
	{
		if (chrome.runtime.lastError) {
			console.log(chrome.runtime.lastError);
		}
		else	// Success! Shortcuts cleared
		{
			// Save data into storage
			chrome.storage.sync.set(shortcuts, function()
			{
				if (chrome.runtime.lastError) {
					console.log(chrome.runtime.lastError);
					alert("Error saving shortcuts!");
				}
				else	// Success! Shortcuts saved
				{
					console.log("saveShortcuts success:", shortcuts);

					// Run through valid shortcuts and set them as saved
					$('tr').each(function(index)
					{
						var $row = $(this);
						if (shortcuts[$row.find('.shortcut').val()]) {
							$row.addClass('saved');
						}
					});


					// Run completion block if exists
					if (completionBlock) {
						completionBlock();
					} else {
						showCrouton('Shortcuts saved!');	// Indicate success saving
					}
				}
			});
		}
	});
}

// Save backup of shortcuts
function backupShortcuts()
{
	var response = confirm("This will save your currently defined shortcuts on the screen and then overwrite the old backup. Continue?");
	if (response)
	{
		saveShortcuts(function() {
			chrome.storage.sync.get(null, function(data)
			{
				if (chrome.runtime.lastError) {	// Check for errors
					console.log(chrome.runtime.lastError);
					alert("Error retrieving shortcuts!");
				}
				else	// Save backup of shortcuts
				{
					var backup = {};
					backup[BACKUP_KEY] = data;
					backup[BACKUP_TIMESTAMP_KEY] = new Date().getTime();
					chrome.storage.local.set(backup, function()
					{
						if (chrome.runtime.lastError) {	// Check for errors
							console.log(chrome.runtime.lastError);
							alert("Could not backup shortcuts! May be over size limit.");
						}
						else {	// Show success
							showCrouton('Shortcuts backed up locally!');
							updateBackupTimestamp();
						}
					});
				}
			});
		});
	}
}

// Update backup timestamp time
function updateBackupTimestamp()
{
	chrome.storage.local.get(BACKUP_TIMESTAMP_KEY, function(data)
	{
		if (chrome.runtime.lastError) {	// Check for errors
			console.log(chrome.runtime.lastError);
		}
		else if (data)	// Set date
		{
			var timestamp = data[BACKUP_TIMESTAMP_KEY];
			if (timestamp) {
				var date = new Date(timestamp).toLocaleString();
				console.log("Last local backup date: " + date);
				$('#restore').text(date).removeClass('disabled');
			} else {
				console.log("No last backup date");
				$('#restore').text("Never").addClass('disabled');
			}
		}
	});
}

// Restore shortcuts from backup
function restoreShortcuts()
{
	// Only enable if restore is not disabled
	if ($('#restore').hasClass('disabled')) {
		return alert("You need to make a backup first!");
	}

	// Confirm restore
	var response = confirm("This will overwrite your current shortcuts! Continue?");
	if (response)
	{
		chrome.storage.local.get(BACKUP_KEY, function(data)
		{
			if (chrome.runtime.lastError) {	// Check for errors
				console.log(chrome.runtime.lastError);
				alert("Error retrieving backup!");
			}
			else	// Restore using backup shortcuts
			{
				console.log("Restoring shortcuts: ", data[BACKUP_KEY]);
				chrome.storage.sync.set(data[BACKUP_KEY], function()
				{
					if (chrome.runtime.lastError) {	// Check for errors
						console.log(chrome.runtime.lastError);
						alert("Could not restore backup! Data may be corrupted or size limits may ahve changed.");
					}
					else {	// Show success
						showCrouton('Shortcuts restored!');
						setupShortcuts();
					}
				});
			}
		});
	}
}

// Create and show and eventually hide a message crouton
function showCrouton(message)
{
	$('body').append($(document.createElement('div'))
		.addClass('crouton').addClass('green').text(message)
		.fadeIn('fast', function() {
			$(this).delay(1000).fadeOut('fast', function() {
				$(this).remove();
			})
		})
	);
}
