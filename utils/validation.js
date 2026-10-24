function validateUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(url.trim());

    return (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function validateText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    return `${field} is required`;
  }

  if (value.trim().length > maxLength) {
    return `${field} must be ${maxLength} characters or less`;
  }

  return null;
}

function validateOptionalText(value, field, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return `${field} must be text`;
  }

  if (value.length > maxLength) {
    return `${field} must be ${maxLength} characters or less`;
  }

  return null;
}

module.exports = {
  validateUrl,
  validateText,
  validateOptionalText,
};