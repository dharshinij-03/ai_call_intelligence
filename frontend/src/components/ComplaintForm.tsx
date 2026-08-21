import { useState, type FormEvent } from "react";

const ComplaintForm = () => {
  const [name, setName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name || !complaint || !location) {
      alert("Please fill in all fields.");
      return;
    }

    console.log({
      name,
      complaint,
      location,
    });

    alert("Complaint submitted successfully!");

    setName("");
    setComplaint("");
    setLocation("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Submit a Complaint</h2>

      <div>
        <label>Name</label>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label>Complaint</label>
        <textarea
          placeholder="Describe your complaint"
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
        />
      </div>

      <div>
        <label>Location</label>
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <button type="submit">
        Submit Complaint
      </button>
    </form>
  );
};

export default ComplaintForm;