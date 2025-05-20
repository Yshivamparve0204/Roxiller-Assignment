const nameRegex = /^.{20,60}$/;
const addressMaxLength = 400;
const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,16}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateUserInput = ({ name, email, address, password }) => {
  if (!name || !nameRegex.test(name)) return 'Name must be 20 to 60 characters';
  if (!email || !emailRegex.test(email)) return 'Invalid email format';
  if (address && address.length > addressMaxLength) return 'Address max 400 characters';
  if (password && !passwordRegex.test(password)) 
    return 'Password must be 8-16 chars, include at least one uppercase letter and one special char';
  return null;
};

module.exports = validateUserInput;
