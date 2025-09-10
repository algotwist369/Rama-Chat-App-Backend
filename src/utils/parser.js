const extractTags = (text) => {
    const regex = /@([a-z0-9_-]+)/ig;
    const out = new Set();
    let m;
    while ((m = regex.exec(text)) !== null) {
        out.add(m[1].toLowerCase());
    }
    return [...out];
}

module.exports = extractTags;
