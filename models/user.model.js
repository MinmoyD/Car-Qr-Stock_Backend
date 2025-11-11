import mongoose , {Schema} from "mongoose";

const userSchema =  new Schema({
    
    name:{
        type:String,
        required:true,
        min:3,
        max:50
    },
    email:{
        type:String,
        required:true,
        unique:true,
        max:50
    },
    password:{
        type:String,
        required:true,
        min:6
    },
    isAdmin:{
        type:Boolean,
        default:false
    }

    
},{timestamps:true});


const User = mongoose.model("User",userSchema);

export default User;