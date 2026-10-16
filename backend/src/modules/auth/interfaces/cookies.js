function readCookie(req, name) {
  const matches = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  try {
    return decodeURIComponent(matches[0].slice(name.length + 1));
  } catch {
    return undefined;
  }
}
function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || process.env.NODE_ENV === 'production',
    path: '/',
  };
}
module.exports = { readCookie, cookieOptions };
