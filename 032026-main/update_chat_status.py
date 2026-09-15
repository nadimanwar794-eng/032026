import re

with open('artifacts/iic-study-app-replit/src/components/WhatsAppChatModal.tsx', 'r') as f:
    content = f.read()

# I need to modify WhatsAppChatModal to hide `isOnline` and `lastSeen` if the users are not friends.
# There are multiple places where `isOnline` is rendered.
# In the `students` list (Find Friends), I should check if the student is in `friends` array.
# I will create a small helper function at the top of the component or just check `friends.some(f => f.id === student.id)`

helper_func = """
  const [searchQuery, setSearchQuery] = useState('');
  
  const isUserFriend = (userId: string) => {
    return friends.some(f => f.id === userId);
  };
"""

content = content.replace(
    "  const [searchQuery, setSearchQuery] = useState('');",
    helper_func
)

# 1. Update the Find Friends list UI: 1590,1670 region
# `student.isOnline ?`
# If not friend -> hide green dot, hide online text, hide lastSeen, just show "Active recently" or hide entirely. Let's just say "Offline" or remove it. Wait, the prompt says: "Nsta messanger me sare user jo ek dusre ka last seen dikhega. Agar friend hai to? Unfriend ho to na dikhega last seen" -> if friend then show last seen/online, if unfriend then hide last seen/online.

# Let's replace the `isOnline` check for the profile picture badge in the All Students list
content = content.replace(
    """{student.isOnline ? (
                        <div
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
                          title="Online"
                        />
                      ) : (
                        <div
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full"
                          title="Offline"
                        />
                      )}""",
    """{isUserFriend(student.id) ? (
                        student.isOnline ? (
                          <div
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
                            title="Online"
                          />
                        ) : (
                          <div
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full"
                            title="Offline"
                          />
                        )
                      ) : null}"""
)

# 2. Update the text below the name in the Find Friends list
content = content.replace(
    """{student.isOnline ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                            <span>Offline {student.lastSeen ? `• ${formatTime(student.lastSeen)}` : ''}</span>
                          </span>
                        )}""",
    """{isUserFriend(student.id) ? (
                          student.isOnline ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              <span>Online</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                              <span>Offline {student.lastSeen ? `• ${formatTime(student.lastSeen)}` : ''}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <span>Private Profile</span>
                          </span>
                        )}"""
)

# 3. Update the header of the direct message (if they open a chat with someone who isn't a friend? wait, you can only chat with friends normally, but you can auto-open on friend request. Just in case, let's wrap the chat header online indicator)
content = content.replace(
    """{selectedContact?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                )}""",
    """{(selectedContact && isUserFriend(selectedContact.id) && selectedContact.isOnline) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                )}"""
)

content = content.replace(
    """{selectedContact ? (
                    selectedContact.isOnline ? (
                      <span className="text-emerald-400 font-semibold">online</span>
                    ) : (
                      'active on Nsta Messenger'
                    )
                  ) : (""",
    """{selectedContact ? (
                    isUserFriend(selectedContact.id) ? (
                      selectedContact.isOnline ? (
                        <span className="text-emerald-400 font-semibold">online</span>
                      ) : (
                        selectedContact.lastSeen ? `last seen ${formatTime(selectedContact.lastSeen)}` : 'Offline'
                      )
                    ) : (
                      'active on Nsta Messenger'
                    )
                  ) : ("""
)

with open('artifacts/iic-study-app-replit/src/components/WhatsAppChatModal.tsx', 'w') as f:
    f.write(content)

print("Status updated.")
