const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGODB_URI;

// MongoDB Client Setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ✅ JWT Verify Middleware 1
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized - No Token" });
  }

  const token = authHeader.split(" ")[1];
  // console.log(token)
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized - Invalid Token" });
    }
    req.decoded = decoded;
    next();
  });
};

// Main function
async function run() {
  try {
    // await client.connect();

    const database = client.db("realEstateDB");

    // Collections 2
    const usersCollection = database.collection("users");
    const propertiesCollection = database.collection("properties");
    const wishlistCollection = database.collection("wishlist");
    const offersCollection = database.collection("offers");
    const reviewCollection = database.collection("reviews");
    const paymentCollection = database.collection("payments");
    const reportsCollection = database.collection("reports");
    const soldPropertiesCollection = database.collection("soldProperties");

    // 🟢 JWT Token Issue 3
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });


    // ✅ Get user role (for useRole hook) 4
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const user = await usersCollection.findOne({ email });
      if (!user) return res.send({ role: null });

      res.send({ role: user.role });
    });



    // Users CRUD 5
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update User Info API 6
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const userInfo = req.body;

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            name: userInfo.name,
            photoURL: userInfo.photoURL,
            phone: userInfo.phone,
            address: userInfo.address,
          },
        }
      );

      res.send(result);
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // user কে fraud হিসেবে চিহ্নিত করা


    app.patch("/users/fraud/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // Step 1: Find the agent using _id
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
          return res.status(404).send({ error: "User not found" });
        }

        // Step 2: Mark user as fraud
        await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isFraud: true } }
        );

        // Step 3: Delete all properties added by this agent
        await propertiesCollection.deleteMany({ agentEmail: user.email });

        res.send({ message: "User marked as fraud and properties removed" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to mark user as fraud" });
      }
    });





    // Wishlist 7

    // app.post("/wishlist", verifyToken, async (req, res) => {
    //   const wishlist = req.body;
    //   const result = await wishlistCollection.insertOne(wishlist);
    //   res.send(result);
    // });

    app.post("/wishlist", async (req, res) => {
      const wishlistData = req.body;
      const { propertyId, userEmail } = wishlistData;
      // console.log(wishlistData)
      try {
        // Check if the item is already in the wishlist
        const existing = await wishlistCollection.findOne({ propertyId, userEmail });

        if (existing) {
          return res.status(400).send({ message: "Already in wishlist" });
        }

        const result = await wishlistCollection.insertOne(wishlistData);
        res.send(result);
      } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).send({ message: "Server error" });
      }
    });


    app.get("/wishlist/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await wishlistCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/wishlist/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Offers-----8--------------------------------

    // app.post("/offers", verifyToken, async (req, res) => {
    //   const offer = req.body;
    //   const result = await offersCollection.insertOne(offer);
    //   res.send(result);
    // });

    // app.post("/offers", verifyToken, async (req, res) => {
    //   const offerData = req.body;
    //   try {
    //     const result = await offersCollection.insertOne(offerData);
    //     res.send(result);
    //   } catch (error) {
    //     res.status(500).send({ message: "Failed to submit offer" });
    //   }
    // });

    app.post("/offers", verifyToken, async (req, res) => {
      try {
        const offer = req.body;
        // console.log("Received Offer Data:", offer);

        //  Validate propertyId
        if (!offer.propertyId || !ObjectId.isValid(offer.propertyId)) {
          return res.status(400).send({ message: "Invalid property ID" });
        }
        // console.log(" offer.propertyId valid:", ObjectId.isValid(offer.propertyId));
        // ১. প্রপার্টি ডেটা নিয়ে আসা
        const property = await propertiesCollection.findOne({ _id: new ObjectId(offer.propertyId) });

        if (!property) {
          return res.status(404).send({ message: "Property not found" });
        }

        // ২. প্রপার্টি বিক্রি হয়ে গেলে অফার গ্রহণ করবেনা
        if (property.status === "sold") {
          return res.status(400).send({ message: "Cannot make offer. Property already sold." });
        }

        // ৩. একই প্রপার্টিতে আগেই অফার করে থাকলে নতুন অফার নিবে না
        const existingOffer = await offersCollection.findOne({
          propertyId: offer.propertyId,
          buyerEmail: offer.buyerEmail,
          status: { $in: ["pending", "accepted"] },
        });

        if (existingOffer) {
          return res.status(400).send({ message: "You have already made an offer for this property." });
        }

        // ৪. নতুন অফার ইনসার্ট করো
        const result = await offersCollection.insertOne(offer);
        res.send(result);

      } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



    app.get("/offers", verifyToken, async (req, res) => {
      const result = await offersCollection.find().toArray();
      res.send(result);
    });

    app.get("/offers/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const offers = await offersCollection.find({ buyerEmail: email }).toArray();
      res.send(offers);
    });

    app.patch("/offers/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const result = await offersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } }
      );
      res.send(result);
    });

    // app.get("/offers/agent/:email", verifyToken, async (req, res) => {
    //   const email = req.params.email;
    //   if (req.decoded.email !== email) {
    //     return res.status(403).send({ message: "Forbidden access" });
    //   }
    //   const offers = await offersCollection.find({ agentEmail: email }).toArray();
    //   res.send(offers);
    // });

    app.patch("/offers/status/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await offersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } }
      );
      res.send(result);
    });


    //  Get all offers for a specific agent 9
    app.get("/offers/agent/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      // নিরাপত্তা চেক
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const offers = await offersCollection.find({ agentEmail: email }).toArray();
        res.send(offers);
      } catch (error) {
        console.error("Error fetching agent offers:", error);
        res.status(500).send({ message: "Failed to fetch offers" });
      }
    });


    // Get all offers for a specific buyer (user) by email
    app.get("/offers/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      // Token এর email মিলছে কিনা চেক করো
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const offers = await offersCollection.find({ buyerEmail: email }).toArray();
        res.send(offers);
      } catch (error) {
        console.error("Error fetching user offers:", error);
        res.status(500).send({ message: "Failed to fetch offers" });
      }
    });
    // ✅ Accept Offer
    app.put("/offers/accept/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const agentEmail = req.body.agentEmail;

      const result = await offersCollection.updateOne(
        { _id: new ObjectId(id), agentEmail },
        { $set: { status: "accepted" } }
      );

      res.send(result);
    });

    // ✅ Reject Offer
    app.put("/offers/reject/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const result = await offersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected" } }
      );

      res.send(result);
    });

    app.get('/offers/single/:id', async (req, res) => {
      const id = req.params.id;
      const offer = await offersCollection.findOne({ _id: new ObjectId(id) });
      res.send(offer);
    });


    // PATCH: Update offer status and transactionId


    // app.patch("/offers/:id/pay", verifyToken, async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const { transactionId, status } = req.body;

    //     const offer = await offersCollection.findOne({ _id: new ObjectId(id) });

    //     if (!offer) {
    //       return res.status(404).send({ message: "Offer not found" });
    //     }

    //     // Step 1: Update the offer document
    //     const updateResult = await offersCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       {
    //         $set: {
    //           status,
    //           transactionId,
    //         },
    //       }
    //     );

    //     // Step 2: Insert into soldPropertiesCollection
    //     const soldProperty = {
    //       propertyId: offer.propertyId || id,
    //       propertyTitle: offer.propertyTitle,
    //       propertyLocation: offer.propertyLocation,
    //       soldPrice: offer.offeredAmount,
    //       buyerEmail: offer.userEmail,
    //       buyerName: offer.userName,
    //       agentEmail: offer.agentEmail,
    //       transactionId: transactionId,
    //       soldAt: new Date(),
    //     };

    //     const insertResult = await soldPropertiesCollection.insertOne(soldProperty);

    //     res.send({
    //       message: "Payment recorded and property marked as sold",
    //       updated: updateResult.modifiedCount > 0,
    //       inserted: insertResult.insertedId ? true : false,
    //     });
    //   } catch (error) {
    //     console.error("Error in payment processing:", error);
    //     res.status(500).send({ message: "Server error during payment" });
    //   }
    // });


    app.patch("/offers/:id/pay", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { transactionId, status } = req.body;

        const offer = await offersCollection.findOne({ _id: new ObjectId(id) });

        if (!offer) {
          return res.status(404).send({ message: "Offer not found" });
        }

        // Step 1: Accept current offer (update with status + transactionId)
        const updateResult = await offersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              transactionId,
            },
          }
        );

        // Step 2: Reject all other offers for same property
        const rejectResult = await offersCollection.updateMany(
          {
            propertyId: offer.propertyId,
            _id: { $ne: new ObjectId(id) },
          },
          { $set: { status: "rejected" } }
        );

        // Step 3: Insert into soldProperties
        const soldProperty = {
          propertyId: offer.propertyId,
          propertyTitle: offer.propertyTitle,
          propertyLocation: offer.propertyLocation,
          soldPrice: offer.offeredAmount,
          buyerEmail: offer.buyerEmail,
          buyerName: offer.buyerName,
          agentEmail: offer.agentEmail,
          transactionId: transactionId,
          soldAt: new Date(),
        };

        const insertResult = await soldPropertiesCollection.insertOne(soldProperty);

        res.send({
          message: "Offer accepted, others rejected, and sale recorded",
          updated: updateResult.modifiedCount > 0,
          rejected: rejectResult.modifiedCount,
          inserted: insertResult.insertedId ? true : false,
        });
      } catch (error) {
        console.error("Error in payment processing:", error);
        res.status(500).send({ message: "Server error during payment" });
      }
    });




    // Reviews 10
    // app.post("/reviews", verifyToken, async (req, res) => {
    //   const review = req.body;
    //   review.time = new Date();
    //   const result = await reviewCollection.insertOne(review);
    //   res.send(result);
    // });

    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;

      // যদি rating না থাকে, তাহলে default 4
      if (!review.rating || review.rating < 1 || review.rating > 5) {
        review.rating = 4;
      }
      // রিভিউ টাইম সংযুক্ত করা
      review.time = new Date();

      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });


    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // app.get("/my-reviews", verifyToken, async (req, res) => {
    //   try {
    //     const email = req.decoded.email;
    //     const userReviews = await reviewCollection.find({ reviewerEmail: email }).toArray();
    //     res.send(userReviews);
    //   } catch (error) {
    //     res.status(500).send({ message: "Failed to fetch reviews" });
    //   }
    // });
    // property reviews
    app.get("/reviews/:propertyId", async (req, res) => {
      const propertyId = req.params.propertyId;
      try {
        const reviews = await reviewCollection.find({ propertyId }).toArray();
        res.send(reviews);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch reviews" });
      }
    });


    // Admin: Get all reviews 11
    app.get("/admin/reviews", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        // console.log(decodedEmail)
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const reviews = await reviewCollection.find().toArray();
        res.send(reviews);
      } catch (error) {
        console.error("Error fetching admin reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews" });
      }
    });

    // Admin: Delete a review
    app.delete("/admin/reviews/:id", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const id = req.params.id;
        const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).send({ message: "Failed to delete review" });
      }
    });

    app.get("/reviews/user/:email", verifyToken, async (req, res) => {

      console.log("Reviews")
      const email = req.params.email;

      // Security check
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const userReviews = await reviewCollection.find({ userEmail: email }).toArray();
        res.send(userReviews);
      } catch (error) {
        console.error("Failed to fetch user reviews:", error);
        res.status(500).send({ message: "Error fetching user reviews" });
      }
    });

    app.delete("/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });


    app.get('/latest/reviews', async (req, res) => {
      // console.log("hello")
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ _id: -1 })  // এখন Date টাইপ ফিল্ড, তাই সঠিকভাবে sort হবে
          .limit(3)
          .toArray();
        // console.log("Fetched Reviews:", reviews);
        res.send(reviews);
      } catch (error) {
        console.error("Failed to fetch latest reviews:", error);
        res.status(500).send({ message: "Failed to fetch latest reviews" });
      }
    });



    app.get('/reviews/latest', async (req, res) => {
      const reviews = await db.collection('reviews').find().sort({ date: -1 }).limit(3).toArray();
      res.send(reviews);
    });


    // Payments 12
    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.get("/payments", verifyToken, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // Properties 13------------------


    // app.get("/properties", async (req, res) => {
    //   const result = await propertiesCollection.find().toArray();
    //   res.send(result);
    // });

    app.get("/properties", async (req, res) => {
      try {
        const { search, sort } = req.query;

        // ✅ Search query + verified/sold filter
        const query = {
          status: { $in: ["verified", "sold"] },
        };

        // ✅ Optional search on location or title
        if (search) {
          query.$or = [
            { location: { $regex: search, $options: "i" } },
            { title: { $regex: search, $options: "i" } },
          ];
        }

        // ✅ Optional sort by priceMin
        const sortOption = {};
        if (sort === "asc") {
          sortOption.priceMin = 1;
        } else if (sort === "desc") {
          sortOption.priceMin = -1;
        }

        // ✅ Find and sort from collection
        const result = await propertiesCollection
          .find(query)
          .sort(sortOption)
          .toArray();

        res.send(result);
      } catch (err) {
        console.error("Failed to fetch properties:", err);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });


    // app.get("/properties/:id", async (req, res) => {
    //   console.log("hello")
    //   const id = req.params.id;
    //   console.log(id)
    //   const result = await propertiesCollection.findOne({ _id: new ObjectId(id) });
    //   res.send(result);
    // });

    //-----
    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await propertiesCollection.findOne({ _id: new ObjectId(id) });
        if (!result) {
          return res.status(404).send({ message: "Property not found" });
        }
        res.send(result);
      } catch (err) {
        console.error("Invalid ObjectId:", err);
        res.status(500).send({ message: "Invalid property ID" });
      }
    });


    //  agent add properties 
    app.get("/properties/agent/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;

        // Token থেকে ইউজার ইমেইল মিলছে কিনা চেক (সিকিউরিটি জন্য)
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const properties = await propertiesCollection.find({ agentEmail: email }).toArray();
        res.send(properties);
      } catch (error) {
        console.error("Error fetching agent properties:", error);
        res.status(500).send({ message: "Failed to fetch properties" });
      }
    });

    // agent sold properties
    app.get("/sold-properties/agent/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;

        // Validate token email === request email
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const soldProperties = await soldPropertiesCollection
          .find({ agentEmail: email })
          .toArray();

        res.send(soldProperties);
      } catch (error) {
        console.error("Error fetching sold properties:", error);
        res.status(500).send({ message: "Failed to fetch sold properties" });
      }
    });

    // ---------

    // Advertisement API route 14

    app.get("/advertised", async (req, res) => {
      const result = await propertiesCollection.find({ advertised: true }).toArray();
      res.send(result);
    });
    app.patch("/properties/advertise/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { advertised: true }
        };
        const result = await propertiesCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to mark as advertised." });
      }
    });

    // app.get('/advertised', async (req, res) => {
    //   try {
    //     const advertised = await propertiesCollection.find({ advertised: true }).toArray();
    //     res.send(advertised);
    //   } catch (error) {
    //     console.error("Error fetching advertised properties:", error);
    //     res.status(500).send({ message: "Failed to fetch advertised properties" });
    //   }
    // });

    // ✅ Get all verified properties for advertising
    app.get("/admin/advertise", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const properties = await propertiesCollection.find({ status: "verified" }).toArray();
        res.send(properties);
      } catch (error) {
        console.error("Error fetching properties for advertise:", error);
        res.status(500).send({ message: "Failed to fetch advertise properties" });
      }
    });

    // ✅ Mark a property as advertised

    app.patch("/admin/advertise/:id", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const id = req.params.id;
        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { advertised: true } }
        );

        res.send(result);
      } catch (error) {
        console.error("Error advertising property:", error);
        res.status(500).send({ message: "Failed to advertise property" });
      }
    });

    // PATCH: Toggle Advertised
    // app.patch("/admin/advertise/:id", verifyToken, verifyAdmin, async (req, res) => {
    //   const id = req.params.id;
    //   try {
    //     const property = await propertiesCollection.findOne({ _id: new ObjectId(id) });

    //     if (!property) {
    //       return res.status(404).send({ message: "Property not found" });
    //     }

    //     const updatedResult = await propertiesCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       { $set: { advertised: !property.advertised } }
    //     );

    //     res.send(updatedResult);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send({ message: "Server error" });
    //   }
    // });


    // app.post("/properties", verifyToken, async (req, res) => {
    //   const property = req.body;
    //   const result = await propertiesCollection.insertOne(property);
    //   res.send(result);
    // });

    app.post("/properties", async (req, res) => {
      try {
        const property = req.body;
        const agentEmail = property.agentEmail;

        // Step 1: Find agent from users collection
        const agent = await usersCollection.findOne({ email: agentEmail });

        // Step 2: Check if fraud
        if (agent?.role === "agent" && agent?.isFraud) {
          return res.status(403).send({ message: "Fraud agents cannot add properties." });
        }

        // Step 3: Add property
        const result = await propertiesCollection.insertOne(property);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add property" });
      }
    });

    // ✅ PATCH: Verify a property (Admin Only)
    app.patch("/admin/properties/verify/:id", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const id = req.params.id;
        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "verified" } }
          // { $set: { verificationStatus: "verified" } }
        );

        res.send(result);
      } catch (error) {
        console.error("Error verifying property:", error);
        res.status(500).send({ message: "Failed to verify property" });
      }
    });

    // Example: PATCH /properties/:id/verify
    // app.patch("/properties/:id/verify", verifyToken, async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     // Update verificationStatus to 'verified'
    //     const result = await propertiesCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       { $set: { verificationStatus: "verified" } }
    //     );

    //     if (result.modifiedCount === 1) {
    //       return res.send({ message: "Property verified successfully" });
    //     } else {
    //       return res.status(404).send({ error: "Property not found" });
    //     }
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send({ error: "Failed to verify property" });
    //   }
    // });


    // ✅ PATCH: Reject a property (Admin Only)
    app.patch("/admin/properties/reject/:id", verifyToken, async (req, res) => {
      try {
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const id = req.params.id;
        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "rejected" } }
        );

        res.send(result);
      } catch (error) {
        console.error("Error rejecting property:", error);
        res.status(500).send({ message: "Failed to reject property" });
      }
    });

    // ✅ Update a property by ID
    app.put("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedProperty = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            title: updatedProperty.title,
            location: updatedProperty.location,
            image: updatedProperty.image,
            priceMin: updatedProperty.priceMin,
            priceMax: updatedProperty.priceMax
          }
        };

        const result = await propertiesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Property update failed:", error);
        res.status(500).send({ message: "Failed to update property" });
      }
    });

    // sold property API
    app.put("/properties/sold/:id", async (req, res) => {

      const id = req.params.id;
      // console.log(id)
      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "sold" } }
      );
      // console.log(result)
      res.send(result);
    });



    app.delete("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Root route
    // app.get("/", (req, res) => {
    //   res.send("Real Estate Platform server is running");
    // });

    // 🔹 POST a Report
    app.post("/report-property", async (req, res) => {
      const report = req.body;
      const result = await reportsCollection.insertOne(report);
      res.send(result);
    });

    // 🔹 GET All Reports(for admin)

    app.get("/admin/reports", async (req, res) => {
      const result = await reportsCollection.find().toArray();
      res.send(result);
    });

    // 🔹 DELETE Property + Delete Related Reviews
    app.delete("/admin/reported-property/:id", async (req, res) => {
      const id = req.params.id;

      const propertyDelete = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
      const reviewDelete = await reviewsCollection.deleteMany({ propertyId: id });
      const reportDelete = await reportsCollection.deleteMany({ propertyId: id });

      res.send({ propertyDelete, reviewDelete, reportDelete });
    });


    // Admin route: Get all properties (Admin Only)
    app.get("/admin/properties", verifyToken, async (req, res) => {
      try {
        // Optional: Role checking (if needed)
        const decodedEmail = req.decoded.email;
        const adminUser = await usersCollection.findOne({ email: decodedEmail });

        if (adminUser?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden - Admins Only" });
        }

        const properties = await propertiesCollection.find().toArray();
        res.send(properties);
      } catch (error) {
        console.error("Error fetching admin properties:", error);
        res.status(500).send({ message: "Failed to fetch properties" });
      }
    });


    // DB connect confirmation
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");

  } catch (error) {
    console.error("❌ Error during DB connection or routes:", error);
  }
}

// Start server
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Real Estate Server Running...");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
